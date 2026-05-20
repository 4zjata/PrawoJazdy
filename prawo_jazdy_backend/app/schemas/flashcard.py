from datetime import datetime

from pydantic import BaseModel


class FlashcardResponse(BaseModel):
    id: int
    sign_code: str
    sign_name: str
    sign_category: str
    description: str
    image_filename: str | None = None

    model_config = {"from_attributes": True}


class FlashcardReviewRequest(BaseModel):
    quality: int  # 0-5


class FlashcardReviewResponse(BaseModel):
    flashcard_id: int
    new_easiness_factor: float
    new_interval_days: float
    next_review: datetime
    repetitions: int


class FlashcardDueResponse(BaseModel):
    flashcard: FlashcardResponse
    easiness_factor: float
    interval_days: float
    repetitions: int
    last_quality: int | None = None
