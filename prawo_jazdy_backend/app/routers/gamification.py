from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.gamification import GamificationProfileResponse, LeaderboardEntry
from app.services.gamification_service import get_or_create_gamification, get_leaderboard

router = APIRouter(prefix="/gamification", tags=["gamification"])


@router.get("/profile", response_model=GamificationProfileResponse)
async def get_profile(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Profil grywalizacji użytkownika."""
    gam = await get_or_create_gamification(db, user.id)

    accuracy = 0.0
    if gam.questions_answered > 0:
        accuracy = round(gam.questions_correct / gam.questions_answered * 100, 2)

    return GamificationProfileResponse(
        total_points=gam.total_points,
        level=gam.level,
        exams_taken=gam.exams_taken,
        exams_passed=gam.exams_passed,
        questions_answered=gam.questions_answered,
        questions_correct=gam.questions_correct,
        accuracy_percent=accuracy,
        current_streak=gam.current_streak,
        best_streak=gam.best_streak,
        last_activity_date=gam.last_activity_date,
        badges=list(gam.badges or []),
    )


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def leaderboard(
    limit: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Tabela liderów."""
    return await get_leaderboard(db, limit)
