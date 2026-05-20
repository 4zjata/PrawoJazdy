from datetime import date

from pydantic import BaseModel


class GamificationProfileResponse(BaseModel):
    total_points: int
    level: int
    exams_taken: int
    exams_passed: int
    questions_answered: int
    questions_correct: int
    accuracy_percent: float
    current_streak: int
    best_streak: int
    last_activity_date: date | None
    badges: list[str]
    next_level_points: int = 0

    model_config = {"from_attributes": True}


class LeaderboardEntry(BaseModel):
    username: str
    total_points: int
    level: int
    exams_passed: int

    model_config = {"from_attributes": True}


class LeaderboardResponse(BaseModel):
    entries: list[LeaderboardEntry]
