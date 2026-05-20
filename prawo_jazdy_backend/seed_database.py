# -*- coding: utf-8 -*-
"""
Main seed script – runs all seeders in order.

Usage:
    python3 seed_database.py
"""

import asyncio
import sys
import os

# Ensure the project root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import settings
from app.database import create_tables, async_session as async_session_maker
from app.seed.import_questions import import_questions
from app.seed.seed_flashcards import seed_flashcards
from app.seed.seed_intersections import seed_intersections


async def main():
    print("=" * 60)
    print("Prawo Jazdy Backend – Database Seeder")
    print("=" * 60)

    # 1. Create tables
    print("\n[1/4] Creating database tables...")
    await create_tables()
    print("      Tables created.")

    async with async_session_maker() as db:
        # 2. Import questions from XLSX
        print("\n[2/4] Importing questions from XLSX...")
        xlsx_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            settings.XLSX_PATH,
        )
        try:
            stats = await import_questions(db, xlsx_path)
            await db.commit()
            print(f"      Imported: katalog={stats['katalog']}, weryfikacja={stats['weryfikacja']}, skipped={stats['skipped']}")
        except Exception as e:
            print(f"      WARNING: Question import failed: {e}")
            await db.rollback()
            print("      Continuing with other seeds...")

        # 3. Seed flashcards
        print("\n[3/4] Seeding flashcards (road signs)...")
        count = await seed_flashcards(db)
        await db.commit()
        print(f"      Seeded {count} flashcards.")

        # 4. Seed intersection scenarios
        print("\n[4/4] Seeding intersection scenarios...")
        await seed_intersections(db)

        # 5. Seed default admin account
        print("\n[5/5] Creating default admin account...")
        from app.services.auth_service import register_user
        try:
            await register_user(db, "admin", "admin@example.com", "admin")
            print("      Created user: admin / admin")
        except ValueError as e:
            print(f"      Admin account already exists: {e}")

    print("\n" + "=" * 60)
    print("Seeding complete!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
