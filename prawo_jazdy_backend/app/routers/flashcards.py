from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.flashcard import Flashcard, SignCategory
from app.models.spaced_repetition import UserFlashcardProgress
from app.schemas.flashcard import FlashcardResponse, FlashcardReviewRequest, FlashcardReviewResponse
from app.services.sm2_service import update_flashcard_progress

router = APIRouter(prefix="/flashcards", tags=["flashcards"])


@router.get("", response_model=list[FlashcardResponse])
async def list_flashcards(
    category: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Lista fiszek wg kategorii znaków."""
    query = select(Flashcard)
    if category:
        try:
            cat_enum = SignCategory(category)
            query = query.where(Flashcard.sign_category == cat_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Nieznana kategoria: {category}")

    result = await db.execute(query.order_by(Flashcard.sign_code))
    return list(result.scalars().all())


@router.get("/review", response_model=list[FlashcardResponse])
async def get_flashcards_for_review(
    count: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Pobiera fiszki do powtórki wg systemu SR."""
    now = datetime.utcnow()

    # Get flashcards due for review
    result = await db.execute(
        select(Flashcard)
        .join(
            UserFlashcardProgress,
            (UserFlashcardProgress.flashcard_id == Flashcard.id)
            & (UserFlashcardProgress.user_id == user.id),
            isouter=True,
        )
        .where(
            (UserFlashcardProgress.id == None)  # noqa: E711
            | (UserFlashcardProgress.next_review <= now)
        )
        .order_by(UserFlashcardProgress.next_review.asc().nullsfirst())
        .limit(count)
    )
    return list(result.scalars().all())


@router.post("/{flashcard_id}/review", response_model=FlashcardReviewResponse)
async def review_flashcard(
    flashcard_id: int,
    data: FlashcardReviewRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Ocena fiszki (0-5) i aktualizacja SR."""
    if data.quality < 0 or data.quality > 5:
        raise HTTPException(status_code=400, detail="Ocena musi być w zakresie 0-5")

    # Check flashcard exists
    result = await db.execute(select(Flashcard).where(Flashcard.id == flashcard_id))
    flashcard = result.scalar_one_or_none()
    if not flashcard:
        raise HTTPException(status_code=404, detail="Fiszka nie znaleziona")

    progress = await update_flashcard_progress(db, user.id, flashcard_id, data.quality)

    return FlashcardReviewResponse(
        flashcard_id=flashcard_id,
        new_easiness_factor=round(progress.easiness_factor, 4),
        new_interval_days=round(progress.interval_days, 2),
        next_review=progress.next_review,
        repetitions=progress.repetitions,
    )
