"""
Algorytm SM-2 (SuperMemo 2) do powtórek rozłożonych w czasie.

Implementacja zgodna ze specyfikacją:
- quality >= 3: odpowiedź poprawna, zwiększamy interwał
- quality < 3: odpowiedź niepoprawna, resetujemy powtórzenia
- EF (Easiness Factor) nigdy nie spada poniżej 1.3
"""

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.spaced_repetition import UserQuestionProgress, UserFlashcardProgress


def calculate_sm2(
    quality: int,
    repetitions: int,
    easiness_factor: float,
    interval_days: float,
) -> tuple[int, float, float, datetime]:
    """
    Algorytm SM-2.

    Args:
        quality: Ocena jakości odpowiedzi (0-5)
        repetitions: Liczba dotychczasowych powtórzeń
        easiness_factor: Aktualny współczynnik łatwości (EF)
        interval_days: Aktualny interwał w dniach

    Returns:
        Krotka (new_repetitions, new_ef, new_interval, next_review)
    """
    if quality < 0 or quality > 5:
        raise ValueError("Ocena jakości musi być w zakresie 0-5")

    if quality >= 3:
        # Poprawna odpowiedź
        if repetitions == 0:
            new_interval = 1.0
        elif repetitions == 1:
            new_interval = 6.0
        else:
            new_interval = interval_days * easiness_factor
        new_repetitions = repetitions + 1
    else:
        # Niepoprawna odpowiedź - reset
        new_repetitions = 0
        new_interval = 1.0

    # Aktualizacja EF (Easiness Factor)
    new_ef = easiness_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ef = max(1.3, new_ef)

    next_review = datetime.utcnow() + timedelta(days=new_interval)

    return new_repetitions, new_ef, new_interval, next_review


async def update_question_progress(
    db: AsyncSession,
    user_id: str,
    question_id: int,
    quality: int,
) -> UserQuestionProgress:
    """Aktualizuje postęp pytania na podstawie SM-2."""
    result = await db.execute(
        select(UserQuestionProgress).where(
            UserQuestionProgress.user_id == user_id,
            UserQuestionProgress.question_id == question_id,
        )
    )
    progress = result.scalar_one_or_none()

    if progress is None:
        progress = UserQuestionProgress(
            user_id=user_id,
            question_id=question_id,
            next_review=datetime.utcnow(),
        )
        db.add(progress)
        await db.flush()

    new_reps, new_ef, new_interval, next_review = calculate_sm2(
        quality=quality,
        repetitions=progress.repetitions,
        easiness_factor=progress.easiness_factor,
        interval_days=progress.interval_days,
    )

    progress.repetitions = new_reps
    progress.easiness_factor = new_ef
    progress.interval_days = new_interval
    progress.next_review = next_review
    progress.last_reviewed = datetime.utcnow()
    progress.last_quality = quality

    return progress


async def update_flashcard_progress(
    db: AsyncSession,
    user_id: str,
    flashcard_id: int,
    quality: int,
) -> UserFlashcardProgress:
    """Aktualizuje postęp fiszki na podstawie SM-2."""
    result = await db.execute(
        select(UserFlashcardProgress).where(
            UserFlashcardProgress.user_id == user_id,
            UserFlashcardProgress.flashcard_id == flashcard_id,
        )
    )
    progress = result.scalar_one_or_none()

    if progress is None:
        progress = UserFlashcardProgress(
            user_id=user_id,
            flashcard_id=flashcard_id,
            next_review=datetime.utcnow(),
        )
        db.add(progress)
        await db.flush()

    new_reps, new_ef, new_interval, next_review = calculate_sm2(
        quality=quality,
        repetitions=progress.repetitions,
        easiness_factor=progress.easiness_factor,
        interval_days=progress.interval_days,
    )

    progress.repetitions = new_reps
    progress.easiness_factor = new_ef
    progress.interval_days = new_interval
    progress.next_review = next_review
    progress.last_reviewed = datetime.utcnow()
    progress.last_quality = quality

    return progress
