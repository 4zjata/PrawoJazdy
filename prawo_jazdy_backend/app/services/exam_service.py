"""
Serwis egzaminu - generuje sesje egzaminacyjne zgodne z oficjalnym formatem.

Egzamin kategorii B:
- Część PODSTAWOWA: 20 pytań TAK/NIE (10×3pkt + 6×2pkt + 4×1pkt)
- Część SPECJALISTYCZNA: 12 pytań ABC (6×3pkt + 4×2pkt + 2×1pkt)
- Łącznie: 32 pytania, max 74 pkt, próg zdania: 68 pkt (≥92%)
"""

import random
from datetime import datetime

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.question import Question, QuestionType, QuestionScope
from app.models.exam import ExamSession, ExamAnswer


# Configuration for standard PORD exams (32 questions, 74 max points)
_STANDARD_CONFIG = {
    "basic": [
        {"points": 3, "count": 10},
        {"points": 2, "count": 6},
        {"points": 1, "count": 4},
    ],
    "specialist": [
        {"points": 3, "count": 6},
        {"points": 2, "count": 4},
        {"points": 1, "count": 2},
    ],
    "max_points": 74,
    "pass_threshold": 68,
    "time_limit_minutes": 25,
}

SUPPORTED_CATEGORIES = ["AM", "A1", "A2", "A", "B", "B1", "C", "C1", "D", "D1", "T"]
EXAM_CONFIG = {cat: _STANDARD_CONFIG for cat in SUPPORTED_CATEGORIES}


async def create_exam_session(
    db: AsyncSession, user_id: str, category: str
) -> tuple[ExamSession, list[dict]]:
    """Tworzy sesję egzaminacyjną z pytaniami wg oficjalnych zasad."""
    config = EXAM_CONFIG.get(category)
    if not config:
        raise ValueError(f"Nieobsługiwana kategoria: {category}")

    selected_questions = []

    # Część podstawowa - TAK/NIE
    for group in config["basic"]:
        result = await db.execute(
            select(Question).where(
                Question.scope == QuestionScope.PODSTAWOWY,
                Question.question_type == QuestionType.TAK_NIE,
                Question.points == group["points"],
                func.concat(',', Question.categories, ',').like(f'%,{category},%'),
                Question.is_verified == True,
            )
        )
        pool = list(result.scalars().all())
        if len(pool) < group["count"]:
            raise ValueError(
                f"Za mało pytań PODSTAWOWYCH TAK/NIE za {group['points']} pkt "
                f"(dostępne: {len(pool)}, wymagane: {group['count']})"
            )
        selected_questions.extend(random.sample(pool, group["count"]))

    # Część specjalistyczna - ABC
    for group in config["specialist"]:
        result = await db.execute(
            select(Question).where(
                Question.scope == QuestionScope.SPECJALISTYCZNY,
                Question.question_type == QuestionType.ABC,
                Question.points == group["points"],
                func.concat(',', Question.categories, ',').like(f'%,{category},%'),
                Question.is_verified == True,
            )
        )
        pool = list(result.scalars().all())
        if len(pool) < group["count"]:
            raise ValueError(
                f"Za mało pytań SPECJALISTYCZNYCH ABC za {group['points']} pkt "
                f"(dostępne: {len(pool)}, wymagane: {group['count']})"
            )
        selected_questions.extend(random.sample(pool, group["count"]))

    # Create session
    session = ExamSession(
        user_id=user_id,
        category=category,
        max_points=config["max_points"],
    )
    db.add(session)
    await db.flush()

    # Create exam answers (empty, to be filled)
    exam_questions = []
    for order, question in enumerate(selected_questions, 1):
        answer = ExamAnswer(
            exam_session_id=session.id,
            question_id=question.id,
            question_order=order,
        )
        db.add(answer)
        exam_questions.append({
            "question_order": order,
            "question_id": question.id,
            "question_number": question.question_number,
            "question_text": question.question_text,
            "answer_a": question.answer_a,
            "answer_b": question.answer_b,
            "answer_c": question.answer_c,
            "question_type": question.question_type.value,
            "media_filename": question.media_filename,
            "points": question.points,
            "scope": question.scope.value,
        })

    await db.flush()
    return session, exam_questions


async def submit_answer(
    db: AsyncSession, session_id: str, user_id: str, question_id: int, answer: str
) -> dict:
    """Zapisuje odpowiedź użytkownika na pytanie egzaminacyjne."""
    # Verify session belongs to user and is not completed
    result = await db.execute(
        select(ExamSession).where(
            ExamSession.id == session_id,
            ExamSession.user_id == user_id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise ValueError("Sesja egzaminacyjna nie znaleziona")
    if session.is_completed:
        raise ValueError("Egzamin został już zakończony")

    # Find the exam answer entry
    result = await db.execute(
        select(ExamAnswer).where(
            ExamAnswer.exam_session_id == session_id,
            ExamAnswer.question_id == question_id,
        )
    )
    exam_answer = result.scalar_one_or_none()
    if not exam_answer:
        raise ValueError("Pytanie nie należy do tego egzaminu")

    # Get the question to check correctness
    result = await db.execute(select(Question).where(Question.id == question_id))
    question = result.scalar_one_or_none()

    is_correct = answer.upper() == question.correct_answer.upper()
    points_earned = question.points if is_correct else 0

    exam_answer.user_answer = answer.upper()
    exam_answer.is_correct = is_correct
    exam_answer.points_earned = points_earned
    exam_answer.answered_at = datetime.utcnow()

    return {
        "question_id": question_id,
        "accepted": True,
        "message": "Odpowiedź zapisana",
    }


async def finish_exam(
    db: AsyncSession, session_id: str, user_id: str
) -> dict:
    """Kończy egzamin i oblicza wynik."""
    result = await db.execute(
        select(ExamSession).where(
            ExamSession.id == session_id,
            ExamSession.user_id == user_id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise ValueError("Sesja egzaminacyjna nie znaleziona")
    if session.is_completed:
        raise ValueError("Egzamin został już zakończony")

    # Calculate total points
    result = await db.execute(
        select(func.sum(ExamAnswer.points_earned)).where(
            ExamAnswer.exam_session_id == session_id
        )
    )
    total_points = result.scalar() or 0

    config = EXAM_CONFIG[session.category]
    passed = total_points >= config["pass_threshold"]

    session.total_points = total_points
    session.passed = passed
    session.is_completed = True
    session.finished_at = datetime.utcnow()

    return {
        "session_id": session_id,
        "total_points": total_points,
        "max_points": session.max_points,
        "passed": passed,
        "pass_threshold": config["pass_threshold"],
    }


async def get_exam_results(
    db: AsyncSession, session_id: str, user_id: str
) -> dict:
    """Pobiera szczegółowe wyniki egzaminu."""
    result = await db.execute(
        select(ExamSession).where(
            ExamSession.id == session_id,
            ExamSession.user_id == user_id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise ValueError("Sesja egzaminacyjna nie znaleziona")

    # Get answers with questions
    result = await db.execute(
        select(ExamAnswer)
        .where(ExamAnswer.exam_session_id == session_id)
        .order_by(ExamAnswer.question_order)
    )
    answers = list(result.scalars().all())

    answer_details = []
    for ans in answers:
        q_result = await db.execute(select(Question).where(Question.id == ans.question_id))
        q = q_result.scalar_one()
        answer_details.append({
            "question_order": ans.question_order,
            "question_id": ans.question_id,
            "question_text": q.question_text,
            "user_answer": ans.user_answer,
            "correct_answer": q.correct_answer,
            "is_correct": ans.is_correct,
            "answer_a": q.answer_a,
            "answer_b": q.answer_b,
            "answer_c": q.answer_c,
            "media_filename": q.media_filename,
            "points_earned": ans.points_earned,
            "points_possible": q.points,
        })

    config = EXAM_CONFIG[session.category]

    return {
        "session_id": session.id,
        "category": session.category,
        "started_at": session.started_at,
        "finished_at": session.finished_at,
        "total_points": session.total_points or 0,
        "max_points": session.max_points,
        "passed": session.passed or False,
        "pass_threshold": config["pass_threshold"],
        "answers": answer_details,
    }


async def get_exam_history(
    db: AsyncSession, user_id: str
) -> list[dict]:
    """Pobiera historię egzaminów użytkownika."""
    result = await db.execute(
        select(ExamSession)
        .where(ExamSession.user_id == user_id)
        .order_by(ExamSession.started_at.desc())
    )
    sessions = list(result.scalars().all())

    return [
        {
            "session_id": s.id,
            "category": s.category,
            "started_at": s.started_at,
            "finished_at": s.finished_at,
            "total_points": s.total_points,
            "max_points": s.max_points,
            "passed": s.passed,
            "is_completed": s.is_completed,
        }
        for s in sessions
    ]
