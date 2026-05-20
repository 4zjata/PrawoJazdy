import enum

from sqlalchemy import Integer, String, Enum, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SignCategory(str, enum.Enum):
    OSTRZEGAWCZE = "OSTRZEGAWCZE"
    ZAKAZU = "ZAKAZU"
    NAKAZU = "NAKAZU"
    INFORMACYJNE = "INFORMACYJNE"
    KIERUNKU = "KIERUNKU"
    UZUPELNIAJACE = "UZUPELNIAJACE"
    TABLICZKI = "TABLICZKI"
    POZIOME = "POZIOME"
    SYGNALY = "SYGNALY"


class Flashcard(Base):
    __tablename__ = "flashcards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sign_code: Mapped[str] = mapped_column(String(20), nullable=False)
    sign_name: Mapped[str] = mapped_column(String(200), nullable=False)
    sign_category: Mapped[SignCategory] = mapped_column(
        Enum(SignCategory), nullable=False
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    image_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
