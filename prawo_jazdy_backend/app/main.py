"""
Prawo Jazdy Backend – FastAPI Application.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import create_tables
from app.routers import (
    auth,
    questions,
    exam,
    flashcards,
    review,
    readiness,
    gamification,
    intersections,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup."""
    await create_tables()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Backend API for Polish driving license exam preparation app",
    lifespan=lifespan,
)

from fastapi.staticfiles import StaticFiles

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import HTTPException
from fastapi.responses import FileResponse
import asyncio
import os

media_dir = os.path.join(os.path.dirname(__file__), "..", "media")

@app.get("/media/{file_path:path}")
async def get_media(file_path: str):
    full_path = os.path.join(media_dir, file_path)
    
    # Sprawdź, czy żądany jest plik .mp4
    if full_path.lower().endswith(".mp4") and not os.path.exists(full_path):
        wmv_path = full_path[:-4] + ".wmv"
        if not os.path.exists(wmv_path):
            wmv_path = full_path[:-4] + ".WMV"
            
        if os.path.exists(wmv_path):
            print(f"JIT Transcoding: {wmv_path} -> {full_path}")
            process = await asyncio.create_subprocess_exec(
                "ffmpeg", "-y", "-i", wmv_path,
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
                "-c:a", "aac", "-b:a", "128k",
                full_path,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL
            )
            await process.wait()
            
    if os.path.exists(full_path):
        return FileResponse(full_path)
        
    raise HTTPException(status_code=404, detail="Media not found")

from fastapi.staticfiles import StaticFiles
znaki_dir = os.path.join(os.path.dirname(__file__), "..", "znaki_drogowe_img")
app.mount("/znaki", StaticFiles(directory=znaki_dir), name="znaki")

# Routers
app.include_router(auth.router)
app.include_router(questions.router)
app.include_router(exam.router)
app.include_router(flashcards.router)
app.include_router(review.router)
app.include_router(readiness.router)
app.include_router(gamification.router)
app.include_router(intersections.router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME}
