import enum

from sqlalchemy import Integer, String, Enum, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class QuestionType(str, enum.Enum):
    TAK_NIE = "TAK_NIE"
    ABC = "ABC"


class QuestionScope(str, enum.Enum):
    PODSTAWOWY = "PODSTAWOWY"
    SPECJALISTYCZNY = "SPECJALISTYCZNY"


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    question_number: Mapped[str] = mapped_column(String(20), nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    answer_a: Mapped[str | None] = mapped_column(Text, nullable=True)
    answer_b: Mapped[str | None] = mapped_column(Text, nullable=True)
    answer_c: Mapped[str | None] = mapped_column(Text, nullable=True)
    correct_answer: Mapped[str] = mapped_column(String(1), nullable=False)
    question_type: Mapped[QuestionType] = mapped_column(
        Enum(QuestionType), nullable=False
    )
    media_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    scope: Mapped[QuestionScope] = mapped_column(Enum(QuestionScope), nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    categories: Mapped[str] = mapped_column(String(100), nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    question_text_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    answer_a_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    answer_b_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    answer_c_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
