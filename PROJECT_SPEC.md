# Driving License Exam Backend - Complete Specification

## Tech Stack
- **Python 3.11+** with **FastAPI**
- **SQLAlchemy 2.0** (async) with **SQLite** (aiosqlite)
- **Alembic** for migrations
- **Pydantic** for schemas
- Project name: `prawo_jazdy_backend`

## Data Source
The file `/home/user/workspace/baza_pytan.xlsx` contains the official Polish driving license exam questions from the Ministry of Infrastructure (gov.pl).

### XLSX Structure (sheet "katalog", 3716 questions + sheet "W trakcie weryfikacji" 180 questions):
| Column | Description |
|--------|-------------|
| Lp | Ordinal number |
| Numer pytania | Question ID number |
| Pytanie | Question text (Polish) |
| Odpowiedź A | Answer A (empty for TAK/NIE questions) |
| Odpowiedź B | Answer B (empty for TAK/NIE questions) |
| Odpowiedź C | Answer C (empty for TAK/NIE questions) |
| Poprawna odp | Correct answer: T/N for yes/no questions, A/B/C for multiple choice |
| Media | Media filename (jpg/jpeg/wmv) or empty |
| Zakres struktury | Scope: "PODSTAWOWY" (basic) or "SPECJALISTYCZNY" (specialist) |
| Liczba punktów | Points: "1", "2", or "3" |
| Kategorie | Comma-separated categories: A,B,C,D,T,AM,A1,A2,B1,C1,D1,PT |

### Question Types:
- **TAK/NIE (Yes/No)**: 2289 questions - Poprawna odp is T or N, answers A/B/C are empty
- **ABC (Multiple Choice)**: 1247 questions - Poprawna odp is A/B/C, answers filled

### Official Exam Structure (Category B):
- **Basic part (PODSTAWOWY)**: 20 questions total
  - 10 questions × 3 points = 30 points
  - 6 questions × 2 points = 12 points
  - 4 questions × 1 point = 4 points
  - All are TAK/NIE (yes/no) type
- **Specialist part (SPECJALISTYCZNY)**: 12 questions total
  - 6 questions × 3 points = 18 points
  - 4 questions × 2 points = 8 points
  - 2 questions × 1 point = 2 points
  - All are ABC (multiple choice) type
- **Total**: 32 questions, max 74 points, **passing threshold: 68 points (≥92%)**
- **Time limit**: 25 minutes
- **TAK/NIE questions**: 15 seconds each (with video media) or 20 seconds (without)
- **ABC questions**: 50 seconds each
- Category B has 2142 questions available

## Database Schema Requirements

### Core Tables:

```
users
- id: UUID PK
- username: str unique
- email: str unique
- password_hash: str
- created_at: datetime
- last_active: datetime

questions
- id: int PK autoincrement
- question_number: str (from "Numer pytania")
- question_text: str
- answer_a: str nullable
- answer_b: str nullable
- answer_c: str nullable
- correct_answer: str (T/N/A/B/C)
- question_type: enum (TAK_NIE, ABC)
- media_filename: str nullable
- scope: enum (PODSTAWOWY, SPECJALISTYCZNY)
- points: int (1/2/3)
- categories: str (comma-separated)
- is_verified: bool (True for main catalog, False for "W trakcie weryfikacji")
- question_text_en: str nullable
- answer_a_en: str nullable
- answer_b_en: str nullable
- answer_c_en: str nullable

exam_sessions
- id: UUID PK
- user_id: FK -> users
- category: str (e.g. "B")
- started_at: datetime
- finished_at: datetime nullable
- total_points: int nullable
- max_points: int (74 for cat B)
- passed: bool nullable
- is_completed: bool default false

exam_answers
- id: int PK
- exam_session_id: FK -> exam_sessions
- question_id: FK -> questions
- user_answer: str nullable
- is_correct: bool nullable
- points_earned: int default 0
- answered_at: datetime nullable
- question_order: int (position in exam)

user_question_progress (for spaced repetition)
- id: int PK
- user_id: FK -> users
- question_id: FK -> questions
- easiness_factor: float default 2.5
- interval_days: float default 1.0
- repetitions: int default 0
- next_review: datetime
- last_reviewed: datetime nullable
- last_quality: int nullable (0-5 SM-2 scale)

flashcards (road signs - predefined)
- id: int PK
- sign_code: str (e.g. "A-1", "B-33")
- sign_name: str
- sign_category: enum (OSTRZEGAWCZE, ZAKAZU, NAKAZU, INFORMACYJNE, KIERUNKU, UZUPELNIAJACE, TABLICZKI, POZIOME, SYGNALY)
- description: str
- image_filename: str nullable

user_flashcard_progress (spaced repetition for flashcards)
- id: int PK
- user_id: FK -> users
- flashcard_id: FK -> flashcards
- easiness_factor: float default 2.5
- interval_days: float default 1.0
- repetitions: int default 0
- next_review: datetime
- last_reviewed: datetime nullable
- last_quality: int nullable

user_gamification
- id: int PK
- user_id: FK -> users (unique)
- total_points: int default 0
- exams_taken: int default 0
- exams_passed: int default 0
- questions_answered: int default 0
- questions_correct: int default 0
- current_streak: int default 0
- best_streak: int default 0
- last_activity_date: date nullable
- level: int default 1
- badges: JSON (list of earned badge codes)

intersection_scenarios
- id: int PK
- name: str
- description: str
- difficulty: enum (EASY, MEDIUM, HARD)
- image_filename: str nullable
- scenario_data: JSON (description of intersection layout)

intersection_vehicles (DAG nodes)
- id: int PK
- scenario_id: FK -> intersection_scenarios
- vehicle_label: str (e.g. "A", "B", "C", "Tramwaj")
- vehicle_type: enum (CAR, TRUCK, TRAM, EMERGENCY, BICYCLE, PEDESTRIAN, USER)
- direction_from: str (e.g. "N", "S", "E", "W")
- direction_to: str
- position_description: str

intersection_priority_edges (DAG edges)
- id: int PK
- scenario_id: FK -> intersection_scenarios
- from_vehicle_id: FK -> intersection_vehicles (the one yielding)
- to_vehicle_id: FK -> intersection_vehicles (the one having priority)
- rule_description: str (e.g. "Reguła prawej strony", "Pojazd uprzywilejowany", "Tramwaj ma pierwszeństwo")

user_intersection_attempts
- id: int PK
- user_id: FK -> users
- scenario_id: FK -> intersection_scenarios
- submitted_order: JSON (list of vehicle labels in user's order)
- is_correct: bool
- feedback: JSON nullable (list of violated edges with explanations)
- attempted_at: datetime
```

## API Endpoints

### Auth
- POST /auth/register
- POST /auth/login (returns JWT)

### Questions
- GET /questions/random?category=B&count=1 (single random question with immediate check)
- POST /questions/{id}/answer (check answer, returns correct/incorrect + explanation)
- GET /questions/stats?category=B (user's stats for category)

### Official Exam Mode
- POST /exam/start?category=B (creates exam session, returns 32 ordered questions per official rules)
- POST /exam/{session_id}/answer (submit answer for current question)
- POST /exam/{session_id}/finish (end exam, calculate score)
- GET /exam/{session_id}/results (detailed results)
- GET /exam/history (user's exam history)

### Flashcards
- GET /flashcards?category=OSTRZEGAWCZE (list flashcards by sign category)
- GET /flashcards/review (get next flashcard due for review based on SR)
- POST /flashcards/{id}/review (submit quality rating 0-5, updates SR)

### Spaced Repetition
- GET /review/next?category=B&count=10 (get questions due for review)
- POST /review/{question_id}/answer (submit answer, auto-calculates quality, updates SM-2)

### Exam Readiness
- GET /readiness?category=B (returns readiness score, EMA, variance, status)

### Gamification
- GET /gamification/profile (user's points, level, badges, streak)
- GET /gamification/leaderboard?limit=10

### Intersection Simulator
- GET /intersections (list all scenarios)
- GET /intersections/{id} (get scenario details: vehicles, layout)
- POST /intersections/{id}/solve (submit order, validate with DAG)
- GET /intersections/{id}/hint (get partial ordering hint)

## Algorithm Specifications

### A. SM-2 Spaced Repetition Algorithm
```
Input: quality (0-5 scale, derived from answer correctness)
- For TAK/NIE: correct=5, incorrect=0
- For ABC: correct=5, incorrect=0
- For flashcards: user self-rates 0-5

Algorithm:
if quality >= 3 (correct answer):
    if repetitions == 0:
        interval = 1 day
    elif repetitions == 1:
        interval = 6 days
    else:
        interval = interval * EF
    repetitions += 1
else (incorrect):
    repetitions = 0
    interval = 1 day

# Update Easiness Factor
EF = EF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
EF = max(1.3, EF)  # EF never below 1.3

next_review = now + interval (in days)
```

### B. Exam Readiness Predictor (EMA + Variance)
```
Based on last N=10 exam results (percentage scores).

EMA Calculation:
- alpha = 2 / (N + 1) where N is number of exams considered
- For each exam score (oldest to newest):
    EMA = alpha * score + (1 - alpha) * previous_EMA
- First EMA = first exam score

Variance Calculation:
- Take last min(10, total_exams) scores
- Calculate sample variance

Readiness Score:
- base_readiness = EMA (as percentage)
- If variance > 100: stability_penalty = min(15, variance / 10)
- Else: stability_penalty = 0
- readiness_score = max(0, min(100, base_readiness - stability_penalty))

Status mapping:
- readiness >= 90 AND variance < 50: "GOTOWY" (Ready)
- readiness >= 75: "PRAWIE_GOTOWY" (Almost ready)
- readiness >= 50: "W_TRAKCIE_NAUKI" (Learning)
- readiness < 50: "WYMAGA_WIECEJ_NAUKI" (Needs more study)
```

### C. Intersection DAG Solver
```
Validate user's order using topological sort:

1. Build directed graph from intersection_priority_edges:
   - Nodes = vehicles
   - Edge A -> B means "A yields to B" (B goes before A)

2. Topological sort (Kahn's algorithm):
   - Find all nodes with in_degree == 0 (they go first)
   - Remove them, update in_degrees, repeat
   - If cycle detected: scenario is invalid

3. Validation of user's order:
   - For each edge (A yields to B):
     - Check that B appears BEFORE A in user's order
     - If not: add to violations list with rule_description
   
4. Note: Multiple valid orderings may exist (when vehicles have equal priority)
   - The validator checks EDGE CONSTRAINTS, not exact ordering
   - Any topologically valid ordering is accepted

5. Feedback on error:
   Return list of violations:
   {
     "yielding_vehicle": "A",
     "priority_vehicle": "B",
     "rule": "Reguła prawej strony",
     "message": "Pojazd A musiał ustąpić pojazdowi B ze względu na regułę prawej strony"
   }
```

## Seed Data Requirements

### Import questions from XLSX:
- Import ALL questions from both sheets
- Map TAK/NIE vs ABC based on correct_answer field
- Import English translations where available

### Flashcards - Polish Road Signs:
Seed at least the major categories with real Polish road signs:
- Ostrzegawcze (Warning): A-1 through A-34 (main ones)
- Zakazu (Prohibition): B-1 through B-42
- Nakazu (Mandatory): C-1 through C-18
- Informacyjne (Information): D-1 through D-52
- Include sign_code, Polish name, and description

### Intersection Scenarios:
Seed at least 5 scenarios of varying difficulty:
1. EASY: Simple 4-way, 2 cars, right-hand rule
2. EASY: T-junction with yield sign
3. MEDIUM: 4-way with tram + 2 cars
4. MEDIUM: Roundabout with 3 vehicles
5. HARD: Complex intersection with emergency vehicle + tram + 3 cars

Each scenario needs proper DAG edges with Polish rule descriptions.

## Project Structure
```
prawo_jazdy_backend/
├── alembic/
│   └── versions/
├── alembic.ini
├── app/
│   ├── __init__.py
│   ├── main.py           (FastAPI app, lifespan, middleware)
│   ├── config.py          (settings)
│   ├── database.py        (engine, session)
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── question.py
│   │   ├── exam.py
│   │   ├── flashcard.py
│   │   ├── spaced_repetition.py
│   │   ├── gamification.py
│   │   └── intersection.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── question.py
│   │   ├── exam.py
│   │   ├── flashcard.py
│   │   ├── readiness.py
│   │   ├── gamification.py
│   │   └── intersection.py
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── questions.py
│   │   ├── exam.py
│   │   ├── flashcards.py
│   │   ├── review.py
│   │   ├── readiness.py
│   │   ├── gamification.py
│   │   └── intersections.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   ├── exam_service.py
│   │   ├── sm2_service.py       (SM-2 algorithm)
│   │   ├── readiness_service.py (EMA + variance)
│   │   ├── gamification_service.py
│   │   └── intersection_service.py (DAG solver)
│   ├── core/
│   │   ├── __init__.py
│   │   ├── security.py   (JWT, password hashing)
│   │   └── dependencies.py (get_current_user, get_db)
│   └── seed/
│       ├── __init__.py
│       ├── import_questions.py (XLSX importer)
│       ├── seed_flashcards.py
│       └── seed_intersections.py
├── requirements.txt
├── seed_database.py       (run all seeds)
└── README.md
```

## Requirements
```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
sqlalchemy[asyncio]>=2.0.0
aiosqlite>=0.20.0
alembic>=1.13.0
pydantic>=2.0.0
pydantic-settings>=2.0.0
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
python-multipart>=0.0.9
openpyxl>=3.1.0
numpy>=1.26.0
```

## Key Implementation Notes
1. ALL code must be production-quality with proper error handling
2. Use async/await throughout
3. The XLSX file is at `/home/user/workspace/baza_pytan.xlsx`
4. Include proper docstrings in Polish for algorithm descriptions
5. Every endpoint must have proper Pydantic request/response models
6. The intersection DAG solver must handle ties (multiple valid orderings)
7. Gamification: award points for correct answers (1-3 based on question difficulty), bonus for exam passes, streak bonuses
8. Level system: level = floor(sqrt(total_points / 10)) + 1
