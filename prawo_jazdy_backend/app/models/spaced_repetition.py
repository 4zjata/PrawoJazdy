from datetime import datetime

from sqlalchemy import Integer, Float, String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserQuestionProgress(Base):
    __tablename__ = "user_question_progress"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    question_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("questions.id"), nullable=False
    )
    easiness_factor: Mapped[float] = mapped_column(Float, default=2.5, nullable=False)
    interval_days: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    repetitions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    next_review: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    last_reviewed: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_quality: Mapped[int | None] = mapped_column(Integer, nullable=True)

    user = relationship("User", back_populates="question_progress")
    question = relationship("Question")


class UserFlashcardProgress(Base):
    __tablename__ = "user_flashcard_progress"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    flashcard_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("flashcards.id"), nullable=False
    )
    easiness_factor: Mapped[float] = mapped_column(Float, default=2.5, nullable=False)
    interval_days: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    repetitions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    next_review: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    last_reviewed: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_quality: Mapped[int | None] = mapped_column(Integer, nullable=True)

    user = relationship("User", back_populates="flashcard_progress")
    flashcard = relationship("Flashcard")
