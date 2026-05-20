"""
Serwis grywalizacji - punkty, poziomy, odznaki, serie.

System poziomów: level = floor(sqrt(total_points / 10)) + 1
Odznaki:
- FIRST_EXAM: Pierwszy egzamin
- FIRST_PASS: Pierwszy zdany egzamin
- STREAK_7: 7 dni z rzędu
- STREAK_30: 30 dni z rzędu
- PERFECT_EXAM: Egzamin na 100%
- QUESTIONS_100: 100 odpowiedzianych pytań
- QUESTIONS_1000: 1000 odpowiedzianych pytań
"""

import math
from datetime import date

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gamification import UserGamification
from app.models.user import User


BADGE_DEFINITIONS = {
    "FIRST_EXAM": "Pierwszy egzamin",
    "FIRST_PASS": "Pierwszy zdany egzamin",
    "STREAK_7": "7 dni nauki z rzędu",
    "STREAK_30": "30 dni nauki z rzędu",
    "PERFECT_EXAM": "Egzamin na 100%",
    "QUESTIONS_100": "100 odpowiedzianych pytań",
    "QUESTIONS_1000": "1000 odpowiedzianych pytań",
}


def calculate_level(total_points: int) -> int:
    """Oblicza poziom: level = floor(sqrt(total_points / 10)) + 1"""
    if total_points <= 0:
        return 1
    return int(math.floor(math.sqrt(total_points / 10.0))) + 1


def points_for_next_level(current_level: int) -> int:
    """Oblicza punkty potrzebne do następnego poziomu."""
    # level = floor(sqrt(points/10)) + 1
    # next_level = current_level + 1
    # points_needed = (next_level - 1)^2 * 10
    return (current_level) ** 2 * 10


def check_badges(gamification: UserGamification) -> list[str]:
    """Sprawdza i przyznaje nowe odznaki."""
    current_badges = list(gamification.badges or [])
    new_badges = set(current_badges)

    if gamification.exams_taken >= 1:
        new_badges.add("FIRST_EXAM")
    if gamification.exams_passed >= 1:
        new_badges.add("FIRST_PASS")
    if gamification.current_streak >= 7:
        new_badges.add("STREAK_7")
    if gamification.current_streak >= 30:
        new_badges.add("STREAK_30")
    if gamification.questions_answered >= 100:
        new_badges.add("QUESTIONS_100")
    if gamification.questions_answered >= 1000:
        new_badges.add("QUESTIONS_1000")

    return sorted(new_badges)


async def get_or_create_gamification(
    db: AsyncSession, user_id: str
) -> UserGamification:
    """Pobiera lub tworzy profil grywalizacji."""
    result = await db.execute(
        select(UserGamification).where(UserGamification.user_id == user_id)
    )
    gamification = result.scalar_one_or_none()

    if not gamification:
        gamification = UserGamification(user_id=user_id, badges=[])
        db.add(gamification)
        await db.flush()

    return gamification


async def award_question_points(
    db: AsyncSession, user_id: str, points: int, is_correct: bool
) -> UserGamification:
    """Przyznaje punkty za odpowiedź na pytanie."""
    gam = await get_or_create_gamification(db, user_id)

    gam.questions_answered += 1
    if is_correct:
        gam.questions_correct += 1
        gam.total_points += points

    # Update streak
    today = date.today()
    if gam.last_activity_date is None:
        gam.current_streak = 1
    elif gam.last_activity_date == today:
        pass  # Already counted today
    elif (today - gam.last_activity_date).days == 1:
        gam.current_streak += 1
    else:
        gam.current_streak = 1

    gam.best_streak = max(gam.best_streak, gam.current_streak)
    gam.last_activity_date = today

    # Update level and badges
    gam.level = calculate_level(gam.total_points)
    gam.badges = check_badges(gam)

    return gam


async def award_exam_completion(
    db: AsyncSession,
    user_id: str,
    passed: bool,
    total_points: int,
    max_points: int,
) -> UserGamification:
    """Przyznaje punkty za ukończenie egzaminu."""
    gam = await get_or_create_gamification(db, user_id)

    gam.exams_taken += 1
    if passed:
        gam.exams_passed += 1
        gam.total_points += 50  # Bonus za zdanie

    if total_points == max_points:
        gam.total_points += 100  # Bonus za perfekcyjny wynik
        if "PERFECT_EXAM" not in (gam.badges or []):
            badges = list(gam.badges or [])
            badges.append("PERFECT_EXAM")
            gam.badges = sorted(badges)

    gam.level = calculate_level(gam.total_points)
    gam.badges = check_badges(gam)

    return gam


async def get_leaderboard(
    db: AsyncSession, limit: int = 10
) -> list[dict]:
    """Pobiera tabelę liderów."""
    result = await db.execute(
        select(UserGamification, User.username)
        .join(User, UserGamification.user_id == User.id)
        .order_by(desc(UserGamification.total_points))
        .limit(limit)
    )
    rows = result.all()

    return [
        {
            "username": username,
            "total_points": gam.total_points,
            "level": gam.level,
            "exams_passed": gam.exams_passed,
        }
        for gam, username in rows
    ]
