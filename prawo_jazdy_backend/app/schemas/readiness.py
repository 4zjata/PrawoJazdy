from pydantic import BaseModel


class ReadinessResponse(BaseModel):
    category: str
    exams_taken: int
    ema: float | None
    variance: float | None
    stability_penalty: float
    readiness_score: float | None
    status: str
    last_scores: list[float]
    message: str
