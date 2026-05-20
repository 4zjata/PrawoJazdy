from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.gamification import UserGamification
from app.core.security import hash_password, verify_password, create_access_token


async def register_user(
    db: AsyncSession, username: str, email: str, password: str
) -> User:
    """Rejestracja nowego użytkownika."""
    # Check if username or email already exists
    result = await db.execute(
        select(User).where((User.username == username) | (User.email == email))
    )
    existing = result.scalar_one_or_none()
    if existing:
        if existing.username == username:
            raise ValueError("Nazwa użytkownika jest już zajęta")
        raise ValueError("Adres email jest już zajęty")

    user = User(
        username=username,
        email=email,
        password_hash=hash_password(password),
    )
    db.add(user)
    await db.flush()

    # Create gamification profile
    gamification = UserGamification(user_id=user.id, badges=[])
    db.add(gamification)
    await db.flush()

    return user


async def authenticate_user(
    db: AsyncSession, username: str, password: str
) -> str:
    """Logowanie użytkownika - zwraca token JWT."""
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(password, user.password_hash):
        raise ValueError("Nieprawidłowa nazwa użytkownika lub hasło")

    # Update last active
    user.last_active = datetime.utcnow()

    token = create_access_token(data={"sub": user.id})
    return token
