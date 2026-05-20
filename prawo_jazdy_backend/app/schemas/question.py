from pydantic import BaseModel


class QuestionResponse(BaseModel):
    id: int
    question_number: str
    question_text: str
    answer_a: str | None = None
    answer_b: str | None = None
    answer_c: str | None = None
    question_type: str
    media_filename: str | None = None
    scope: str
    points: int
    categories: str
    question_text_en: str | None = None
    answer_a_en: str | None = None
    answer_b_en: str | None = None
    answer_c_en: str | None = None

    model_config = {"from_attributes": True}


class AnswerRequest(BaseModel):
    answer: str


class AnswerResponse(BaseModel):
    question_id: int
    user_answer: str
    correct_answer: str
    is_correct: bool
    points: int
    explanation: str | None = None


class QuestionStatsResponse(BaseModel):
    category: str
    total_questions: int
    questions_answered: int
    questions_correct: int
    accuracy_percent: float
    questions_due_for_review: int
