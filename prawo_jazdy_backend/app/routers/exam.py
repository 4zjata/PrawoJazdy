from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.exam import (
    ExamStartResponse,
    ExamAnswerRequest,
    ExamAnswerResponse,
    ExamResultResponse,
    ExamHistoryItem,
)
from app.services.exam_service import (
    create_exam_session,
    submit_answer,
    finish_exam,
    get_exam_results,
    get_exam_history,
    EXAM_CONFIG,
)
from app.services.gamification_service import award_exam_completion

router = APIRouter(prefix="/exam", tags=["exam"])


@router.post("/start", response_model=ExamStartResponse)
async def start_exam(
    category: str = Query("B"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Rozpoczyna sesję egzaminacyjną."""
    try:
        session, questions = await create_exam_session(db, user.id, category)
        config = EXAM_CONFIG[category]
        return ExamStartResponse(
            session_id=session.id,
            category=category,
            total_questions=len(questions),
            max_points=config["max_points"],
            time_limit_minutes=config["time_limit_minutes"],
            questions=questions,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{session_id}/answer", response_model=ExamAnswerResponse)
async def answer_exam_question(
    session_id: str,
    data: ExamAnswerRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Zapisuje odpowiedź na pytanie egzaminacyjne."""
    try:
        result = await submit_answer(db, session_id, user.id, data.question_id, data.answer)
        return ExamAnswerResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{session_id}/finish")
async def finish_exam_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Kończy egzamin i oblicza wynik."""
    try:
        result = await finish_exam(db, session_id, user.id)

        # Award gamification
        await award_exam_completion(
            db,
            user.id,
            passed=result["passed"],
            total_points=result["total_points"],
            max_points=result["max_points"],
        )

        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{session_id}/results", response_model=ExamResultResponse)
async def get_results(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Szczegółowe wyniki egzaminu."""
    try:
        return await get_exam_results(db, session_id, user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/history", response_model=list[ExamHistoryItem])
async def get_history(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Historia egzaminów użytkownika."""
    return await get_exam_history(db, user.id)
