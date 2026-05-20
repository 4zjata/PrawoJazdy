from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.question import Question
from app.models.spaced_repetition import UserQuestionProgress
from app.schemas.question import QuestionResponse, AnswerRequest, AnswerResponse
from app.services.sm2_service import update_question_progress
from app.services.gamification_service import award_question_points

router = APIRouter(prefix="/review", tags=["review"])


@router.get("/next", response_model=list[QuestionResponse])
async def get_next_review(
    category: str = Query("B"),
    count: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Pobiera pytania do powtórki wg systemu SR."""
    now = datetime.utcnow()

    # Get questions due for review
    result = await db.execute(
        select(Question)
        .join(
            UserQuestionProgress,
            (UserQuestionProgress.question_id == Question.id)
            & (UserQuestionProgress.user_id == user.id),
        )
        .where(
            UserQuestionProgress.next_review <= now,
            func.concat(',', Question.categories, ',').like(f'%,{category},%'),
        )
        .order_by(UserQuestionProgress.next_review.asc())
        .limit(count)
    )
    return list(result.scalars().all())


@router.post("/{question_id}/answer", response_model=AnswerResponse)
async def review_answer(
    question_id: int,
    data: AnswerRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Odpowiedź na pytanie w trybie powtórki, aktualizacja SM-2."""
    result = await db.execute(select(Question).where(Question.id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Pytanie nie znalezione")

    is_correct = data.answer.upper() == question.correct_answer.upper()
    quality = 5 if is_correct else 0

    await update_question_progress(db, user.id, question_id, quality)

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
