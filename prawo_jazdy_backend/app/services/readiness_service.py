"""
Predyktor gotowości do egzaminu oparty na EMA (Exponential Moving Average)
i wariancji wyników.

Algorytm:
1. EMA z ostatnich N=10 egzaminów (alpha = 2/(N+1))
2. Wariancja próbkowa z ostatnich wyników
3. Kara za niestabilność (jeśli wariancja > 100)
4. Status gotowości na podstawie wyniku
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exam import ExamSession


def calculate_ema(scores: list[float], n: int = 10) -> float:
    """
    Oblicza EMA (Exponential Moving Average).

    Alpha = 2 / (N + 1), gdzie N to liczba uwzględnianych egzaminów.
    Pierwsza wartość EMA = pierwszy wynik.
    """
    if not scores:
        return 0.0

    alpha = 2.0 / (n + 1)
    ema = scores[0]

    for score in scores[1:]:
        ema = alpha * score + (1.0 - alpha) * ema

    return ema


def calculate_variance(scores: list[float]) -> float:
    """Oblicza wariancję próbkową."""
    if len(scores) < 2:
        return 0.0

    mean = sum(scores) / len(scores)
    return sum((s - mean) ** 2 for s in scores) / (len(scores) - 1)


def calculate_readiness(scores: list[float]) -> dict:
    """
    Oblicza gotowość do egzaminu.

    Returns:
        Słownik z EMA, wariancją, karą, wynikiem i statusem.
    """
    if not scores:
        return {
            "ema": None,
            "variance": None,
            "stability_penalty": 0.0,
            "readiness_score": None,
            "status": "WYMAGA_WIECEJ_NAUKI",
            "message": "Brak wyników egzaminów. Rozwiąż przynajmniej jeden egzamin.",
        }

    # Bierz ostatnie 10 wyników
    recent = scores[-10:]

    ema = calculate_ema(recent, n=len(recent))
    variance = calculate_variance(recent)

    # Kara za niestabilność
    if variance > 100:
        stability_penalty = min(15.0, variance / 10.0)
    else:
        stability_penalty = 0.0

    readiness_score = max(0.0, min(100.0, ema - stability_penalty))

    # Status
    if readiness_score >= 90 and variance < 50:
        status = "GOTOWY"
        message = "Jesteś gotowy do egzaminu! Twoje wyniki są wysokie i stabilne."
    elif readiness_score >= 75:
        status = "PRAWIE_GOTOWY"
        message = "Prawie gotowy! Powtórz jeszcze słabsze tematy."
    elif readiness_score >= 50:
        status = "W_TRAKCIE_NAUKI"
        message = "Jesteś w trakcie nauki. Kontynuuj rozwiązywanie egzaminów."
    else:
        status = "WYMAGA_WIECEJ_NAUKI"
        message = "Wymaga więcej nauki. Skup się na powtórkach i fiszach."

    return {
        "ema": round(ema, 2),
        "variance": round(variance, 2),
        "stability_penalty": round(stability_penalty, 2),
        "readiness_score": round(readiness_score, 2),
        "status": status,
        "message": message,
    }


async def get_readiness(
    db: AsyncSession, user_id: str, category: str
) -> dict:
    """Pobiera gotowość użytkownika na podstawie historii egzaminów."""
    result = await db.execute(
        select(ExamSession)
        .where(
            ExamSession.user_id == user_id,
            ExamSession.category == category,
            ExamSession.is_completed == True,
        )
        .order_by(ExamSession.finished_at.asc())
    )
    sessions = list(result.scalars().all())

    # Calculate percentage scores
    scores = []
    for s in sessions:
        if s.max_points and s.max_points > 0:
            pct = (s.total_points / s.max_points) * 100.0
            scores.append(pct)

    readiness = calculate_readiness(scores)
    readiness["category"] = category
    readiness["exams_taken"] = len(scores)
    readiness["last_scores"] = [round(s, 2) for s in scores[-10:]]

    return readiness
