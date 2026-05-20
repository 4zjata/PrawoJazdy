import uuid
from datetime import datetime

from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    last_active: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    exam_sessions = relationship("ExamSession", back_populates="user")
    question_progress = relationship("UserQuestionProgress", back_populates="user")
    flashcard_progress = relationship("UserFlashcardProgress", back_populates="user")
    gamification = relationship("UserGamification", back_populates="user", uselist=False)
    intersection_attempts = relationship("UserIntersectionAttempt", back_populates="user")
