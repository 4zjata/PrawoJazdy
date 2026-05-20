from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.readiness import ReadinessResponse
from app.services.readiness_service import get_readiness

router = APIRouter(prefix="/readiness", tags=["readiness"])


@router.get("", response_model=ReadinessResponse)
async def check_readiness(
    category: str = Query("B"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Sprawdza gotowość do egzaminu na podstawie EMA + wariancji."""
    result = await get_readiness(db, user.id, category)
    return ReadinessResponse(**result)
