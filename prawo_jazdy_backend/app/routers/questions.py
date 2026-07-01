import random
from datetime import datetime
import base64
import json
import os
import ssl
import urllib.request
import urllib.error
import asyncio
import requests
import queue
import threading

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.question import Question
from app.models.spaced_repetition import UserQuestionProgress
from app.schemas.question import QuestionResponse, AnswerRequest, AnswerResponse, QuestionStatsResponse
from app.services.sm2_service import update_question_progress
from app.services.gamification_service import award_question_points
from app.config import settings

router = APIRouter(prefix="/questions", tags=["questions"])


@router.get("/random", response_model=list[QuestionResponse])
async def get_random_questions(
    category: str = Query("B"),
    count: int = Query(1, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Losowe pytania z danej kategorii."""
    result = await db.execute(
        select(Question).where(
            func.concat(',', Question.categories, ',').like(f'%,{category},%'),
            Question.is_verified == True,
        )
    )
    questions = list(result.scalars().all())

    if not questions:
        raise HTTPException(status_code=404, detail="Brak pytań dla tej kategorii")

    progress_result = await db.execute(
        select(UserQuestionProgress.question_id, UserQuestionProgress.last_quality).where(
            UserQuestionProgress.user_id == user.id
        )
    )
    progress_map = {row.question_id: row.last_quality for row in progress_result.all()}

    weights = []
    for q in questions:
        last_quality = progress_map.get(q.id)
        weight = 10.0
        if last_quality is not None:
            if last_quality < 3:
                weight = 20.0
            else:
                weight = 5.0
        weights.append(weight)

    selected = []
    if count >= len(questions):
        selected = questions
    else:
        indices = list(range(len(questions)))
        for _ in range(count):
            if not indices:
                break
            w = [weights[i] for i in indices]
            idx = random.choices(indices, weights=w, k=1)[0]
            indices.remove(idx)
            selected.append(questions[idx])

    return selected


@router.post("/{question_id}/answer", response_model=AnswerResponse)
async def answer_question(
    question_id: int,
    data: AnswerRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Sprawdź odpowiedź na pytanie i zaktualizuj SR."""
    result = await db.execute(select(Question).where(Question.id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Pytanie nie znalezione")

    is_correct = data.answer.upper() == question.correct_answer.upper()
    quality = 5 if is_correct else 0

    # Update spaced repetition
    await update_question_progress(db, user.id, question_id, quality)

    # Award gamification points
    points = question.points if is_correct else 0
    await award_question_points(db, user.id, points, is_correct)

    explanation = None

    return AnswerResponse(
        question_id=question_id,
        user_answer=data.answer.upper(),
        correct_answer=question.correct_answer,
        is_correct=is_correct,
        points=points,
        explanation=explanation,
    )


@router.get("/{question_id}/explain-ai")
async def explain_question_ai(
    question_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Generates AI explanation using clanker.voidy.xyz sonnet model (streaming)."""
    result = await db.execute(select(Question).where(Question.id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Pytanie nie znalezione")

    # Exclude video questions
    media_file = question.media_filename
    if media_file and media_file.lower().endswith((".mp4", ".wmv")):
        raise HTTPException(status_code=400, detail="Wyjaśnienia AI nie są dostępne dla pytań z filmem wideo.")

    # Prepare prompt
    correct_ans = question.correct_answer.upper()
    
    if question.question_type == "TAK_NIE":
        correct_friendly = "TAK" if correct_ans == "T" else "NIE"
        prompt_text = (
            f"Jesteś ekspertem ds. przepisów ruchu drogowego w Polsce.\n"
            f"Przeanalizuj poniższe pytanie egzaminacyjne na prawo jazdy (Numer pytania: {question.question_number}) "
            f"i wyjaśnij, dlaczego poprawna odpowiedź to {correct_friendly}.\n\n"
            f"Treść pytania: {question.question_text}\n"
            f"Możliwe odpowiedzi: TAK lub NIE.\n"
            f"Poprawna odpowiedź: {correct_friendly}.\n\n"
            f"Napisz BARDZO ZWIĘZŁE (maksymalnie 2 zdania), jasne i konkretne wyjaśnienie w języku polskim, dlaczego ta odpowiedź jest prawidłowa. "
            f"Przejdź od razu do rzeczy (bez wstępów w stylu 'odpowiedź jest poprawna, ponieważ...')."
        )
    else:
        correct_text = ""
        if correct_ans == "A":
            correct_text = question.answer_a
        elif correct_ans == "B":
            correct_text = question.answer_b
        elif correct_ans == "C":
            correct_text = question.answer_c

        prompt_text = (
            f"Jesteś ekspertem ds. przepisów ruchu drogowego w Polsce.\n"
            f"Przeanalizuj poniższe pytanie egzaminacyjne na prawo jazdy (Numer pytania: {question.question_number}) "
            f"i wyjaśnij, dlaczego poprawna odpowiedź to {correct_ans} ({correct_text}).\n\n"
            f"Treść pytania: {question.question_text}\n"
            f"Opcje odpowiedzi:\n"
            f"A: {question.answer_a}\n"
            f"B: {question.answer_b}\n"
            f"C: {question.answer_c}\n\n"
            f"Poprawna odpowiedź: {correct_ans} ({correct_text}).\n\n"
            f"Napisz BARDZO ZWIĘZŁE (maksymalnie 2 zdania), jasne i konkretne wyjaśnienie w języku polskim, dlaczego ta odpowiedź jest prawidłowa, "
            f"a pozostałe opcje są błędne. Przejdź od razu do rzeczy (bez wstępów)."
        )

    # Check for image
    has_image = False
    encoded_string = ""
    mime_type = "image/jpeg"
    if media_file:
        media_dir = os.path.join(os.path.dirname(__file__), "..", "..", "media")
        full_path = os.path.join(media_dir, media_file)
        if os.path.exists(full_path) and os.path.isfile(full_path):
            try:
                with open(full_path, "rb") as image_file:
                    encoded_string = base64.b64encode(image_file.read()).decode("utf-8")
                has_image = True
                if media_file.lower().endswith(".png"):
                    mime_type = "image/png"
                elif media_file.lower().endswith(".gif"):
                    mime_type = "image/gif"
            except Exception as e:
                print(f"Error reading image file {full_path}: {e}")

    # Build messages payload
    if has_image:
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt_text},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{encoded_string}"
                        }
                    }
                ]
            }
        ]
    else:
        messages = [
            {"role": "user", "content": prompt_text}
        ]

    # Call clanker API streaming
    async def make_api_call_stream():
        api_key = settings.CLANKER_API_KEY
        if not api_key:
            yield "data: " + json.dumps({"error": "Brak skonfigurowanego klucza API (CLANKER_API_KEY) w pliku .env."}) + "\n\n"
            return
            
        url = settings.CLANKER_API_URL.rstrip('/') + "/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        chat_data = {
            "model": "sonnet",
            "messages": messages,
            "max_tokens": 300,
            "stream": True
        }
        
        q = queue.Queue()
        
        def run_request():
            try:
                # Disable SSL verify check to prevent certificate issues on macOS/VPS
                response = requests.post(url, headers=headers, json=chat_data, stream=True, timeout=60, verify=False)
                if response.status_code != 200:
                    q.put(("error", f"Błąd API clanker: status {response.status_code}"))
                    return
                for line in response.iter_lines():
                    if line:
                        decoded = line.decode('utf-8').strip()
                        q.put(("data", decoded))
            except Exception as e:
                q.put(("error", str(e)))
            finally:
                q.put(("done", None))

        # Run request in background thread
        thread = threading.Thread(target=run_request)
        thread.start()
        
        while True:
            try:
                msg_type, val = q.get_nowait()
                if msg_type == "done":
                    break
                elif msg_type == "error":
                    yield "data: " + json.dumps({"error": val}) + "\n\n"
                    break
                elif msg_type == "data":
                    yield f"{val}\n\n"
            except queue.Empty:
                await asyncio.sleep(0.05)

    return StreamingResponse(make_api_call_stream(), media_type="text/event-stream")


@router.get("/stats", response_model=QuestionStatsResponse)
async def get_question_stats(
    category: str = Query("B"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Statystyki użytkownika dla danej kategorii."""
    # Total questions in category
    result = await db.execute(
        select(func.count(Question.id)).where(
            func.concat(',', Question.categories, ',').like(f'%,{category},%'),
            Question.is_verified == True,
        )
    )
    total_questions = result.scalar() or 0

    # User's progress
    result = await db.execute(
        select(UserQuestionProgress)
        .join(Question, UserQuestionProgress.question_id == Question.id)
        .where(
            UserQuestionProgress.user_id == user.id,
            func.concat(',', Question.categories, ',').like(f'%,{category},%'),
        )
    )
    progress_list = list(result.scalars().all())

    questions_answered = len(progress_list)
    questions_correct = sum(1 for p in progress_list if p.last_quality and p.last_quality >= 3)

    accuracy = (questions_correct / questions_answered * 100) if questions_answered > 0 else 0.0

    now = datetime.utcnow()
    due_count = sum(1 for p in progress_list if p.next_review <= now)

    return QuestionStatsResponse(
        category=category,
        total_questions=total_questions,
        questions_answered=questions_answered,
        questions_correct=questions_correct,
        accuracy_percent=round(accuracy, 2),
        questions_due_for_review=due_count,
    )
