import random
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.question import Question
from app.models.spaced_repetition import UserQuestionProgress
from app.schemas.question import QuestionResponse, AnswerRequest, AnswerResponse, QuestionStatsResponse
from app.services.sm2_service import update_question_progress
from app.services.gamification_service import award_question_points

router = APIRouter(prefix="/questions", tags=["questions"])


@router.get("/random", response_model=list[QuestionResponse])
async def get_random_questions(
    category: str = Query("B"),
    count: int = Query(1, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Losowe pytania z danej kategorii."""
    result = await db.execute(
        select(Question).where(
            func.concat(',', Question.categories, ',').like(f'%,{category},%'),
            Question.is_verified == True,
        )
    )
    questions = list(result.scalars().all())

    if not questions:
        raise HTTPException(status_code=404, detail="Brak pytań dla tej kategorii")

    progress_result = await db.execute(
        select(UserQuestionProgress.question_id, UserQuestionProgress.last_quality).where(
            UserQuestionProgress.user_id == user.id
        )
    )
    progress_map = {row.question_id: row.last_quality for row in progress_result.all()}

    weights = []
    for q in questions:
        last_quality = progress_map.get(q.id)
        weight = 10.0
        if last_quality is not None:
            if last_quality < 3:
                weight = 20.0
            else:
                weight = 5.0
        weights.append(weight)

    selected = []
    if count >= len(questions):
        selected = questions
    else:
        indices = list(range(len(questions)))
        for _ in range(count):
            if not indices:
                break
            w = [weights[i] for i in indices]
            idx = random.choices(indices, weights=w, k=1)[0]
            indices.remove(idx)
            selected.append(questions[idx])

    return selected


@router.post("/{question_id}/answer", response_model=AnswerResponse)
async def answer_question(
    question_id: int,
    data: AnswerRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Sprawdź odpowiedź na pytanie i zaktualizuj SR."""
    result = await db.execute(select(Question).where(Question.id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Pytanie nie znalezione")

    is_correct = data.answer.upper() == question.correct_answer.upper()
    quality = 5 if is_correct else 0

    # Update spaced repetition
    await update_question_progress(db, user.id, question_id, quality)

    # Award gamification points
    points = question.points if is_correct else 0
    await award_question_points(db, user.id, points, is_correct)

    explanation = None

    return AnswerResponse(
        question_id=question_id,
        user_answer=data.answer.upper(),
        correct_answer=question.correct_answer,
        is_correct=is_correct,
        points=points,
        explanation=explanation,
    )


@router.get("/stats", response_model=QuestionStatsResponse)
async def get_question_stats(
    category: str = Query("B"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Statystyki użytkownika dla danej kategorii."""
    # Total questions in category
    result = await db.execute(
        select(func.count(Question.id)).where(
            func.concat(',', Question.categories, ',').like(f'%,{category},%'),
            Question.is_verified == True,
        )
    )
    total_questions = result.scalar() or 0

    # User's progress
    result = await db.execute(
        select(UserQuestionProgress)
        .join(Question, UserQuestionProgress.question_id == Question.id)
        .where(
            UserQuestionProgress.user_id == user.id,
            func.concat(',', Question.categories, ',').like(f'%,{category},%'),
        )
    )
    progress_list = list(result.scalars().all())

    questions_answered = len(progress_list)
    questions_correct = sum(1 for p in progress_list if p.last_quality and p.last_quality >= 3)

    accuracy = (questions_correct / questions_answered * 100) if questions_answered > 0 else 0.0

    now = datetime.utcnow()
    due_count = sum(1 for p in progress_list if p.next_review <= now)

    return QuestionStatsResponse(
        category=category,
        total_questions=total_questions,
        questions_answered=questions_answered,
        questions_correct=questions_correct,
        accuracy_percent=round(accuracy, 2),
        questions_due_for_review=due_count,
    )
