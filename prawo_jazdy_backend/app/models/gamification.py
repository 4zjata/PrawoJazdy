from datetime import date

from sqlalchemy import Integer, String, Date, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserGamification(Base):
    __tablename__ = "user_gamification"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), unique=True, nullable=False
    )
    total_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    exams_taken: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    exams_passed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    questions_answered: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    questions_correct: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    current_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    best_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_activity_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    badges: Mapped[dict | None] = mapped_column(JSON, default=list)

    user = relationship("User", back_populates="gamification")
