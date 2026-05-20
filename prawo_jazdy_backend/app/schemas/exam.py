from datetime import datetime

from pydantic import BaseModel


class ExamQuestionResponse(BaseModel):
    question_order: int
    question_id: int
    question_number: str
    question_text: str
    answer_a: str | None = None
    answer_b: str | None = None
    answer_c: str | None = None
    question_type: str
    media_filename: str | None = None
    points: int
    scope: str


class ExamStartResponse(BaseModel):
    session_id: str
    category: str
    total_questions: int
    max_points: int
    time_limit_minutes: int
    questions: list[ExamQuestionResponse]


class ExamAnswerRequest(BaseModel):
    question_id: int
    answer: str


class ExamAnswerResponse(BaseModel):
    question_id: int
    accepted: bool
    message: str


class ExamAnswerDetail(BaseModel):
    question_order: int
    question_id: int
    question_text: str
    user_answer: str | None
    correct_answer: str
    is_correct: bool | None
    media_filename: str | None = None
    answer_a: str | None = None
    answer_b: str | None = None
    answer_c: str | None = None
    points_earned: int
    points_possible: int

    model_config = {"from_attributes": True}


class ExamResultResponse(BaseModel):
    session_id: str
    category: str
    started_at: datetime
    finished_at: datetime | None
    total_points: int
    max_points: int
    passed: bool
    pass_threshold: int
    answers: list[ExamAnswerDetail]


class ExamHistoryItem(BaseModel):
    session_id: str
    category: str
    started_at: datetime
    finished_at: datetime | None
    total_points: int | None
    max_points: int
    passed: bool | None
    is_completed: bool

    model_config = {"from_attributes": True}
