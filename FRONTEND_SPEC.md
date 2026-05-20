# Frontend Specification — Prawo Jazdy App

## Overview
Build a complete, production-quality React web application for Polish driving license exam preparation. The app connects to an existing FastAPI backend running on port 8000. The app must be in POLISH language throughout.

## Architecture Decision
Use the fullstack webapp template (skills/webapp/template) but with a TWIST:
- The Express backend serves as a **proxy** to the existing FastAPI backend on port 8000
- All API calls from React go through Express (port 5000), which forwards them to FastAPI (port 8000)
- This means: in `server/routes.ts`, set up proxy routes that forward requests to `http://localhost:8000`
- Use `http-proxy-middleware` or manual fetch forwarding in Express routes

## Art Direction — Driving School / Education App
This is an EDUCATION app for driving license. Derive the palette:
- **Color**: Cool blue-green primary (road signs feel), dark slate surfaces in dark mode, clean white in light. Accent: vibrant green for success/correct, warm red-orange for errors/incorrect. Think of the blue of road signs combined with educational freshness.
- **Typography**: Clean sans-serif. Use Inter or DM Sans. Functional, clear, good at small sizes.
- **Spacing**: Moderate density — not too sparse (lots of data), not too cramped.
- **Motion**: Functional transitions. Card flips for flashcards. Smooth progress animations.
- **Mood**: Professional yet approachable. Like a modern e-learning platform.

### HSL Palette (for index.css)
Light mode primary: `200 80% 35%` (blue-teal road sign color)
Dark mode primary: `200 55% 55%`
Success: `142 72% 40%` (green for correct)
Error/destructive: `0 72% 50%` (red for wrong)
Background light: `210 20% 98%`
Background dark: `220 15% 10%`

## Backend API Reference

The FastAPI backend runs on port 8000 with these endpoints. ALL endpoints except /auth/* require Bearer token in Authorization header.

### Auth
- POST /auth/register — body: {username, email, password} → returns user object
- POST /auth/login — body: {username, password} → returns {access_token, token_type}

### Questions (Single Question Mode)
- GET /questions/random?category=B&count=1 → returns array of questions
- POST /questions/{id}/answer — body: {answer: "T"|"N"|"A"|"B"|"C"} → returns {question_id, user_answer, correct_answer, is_correct, points, explanation}
- GET /questions/stats?category=B → returns {category, total_questions, questions_answered, questions_correct, accuracy_percent, questions_due_for_review}

### Official Exam
- POST /exam/start?category=B → returns {session_id, category, total_questions: 32, max_points: 74, time_limit_minutes: 25, questions: [...]}
  - Questions include: question_order, question_id, question_number, question_text, answer_a/b/c, question_type ("TAK_NIE" or "ABC"), media_filename, points, scope
- POST /exam/{session_id}/answer — body: {question_id, answer} → returns {question_id, accepted, message}
- POST /exam/{session_id}/finish → returns {session_id, total_points, max_points, passed, pass_threshold: 68}
- GET /exam/{session_id}/results → returns full results with all answers
- GET /exam/history → returns list of past exams (NOTE: this endpoint returns [] for first requests)

### Spaced Repetition Review
- GET /review/next?category=B&count=10 → questions due for review
- POST /review/{question_id}/answer — body: {answer} → same as questions answer

### Flashcards (Road Signs)
- GET /flashcards?category=OSTRZEGAWCZE → list flashcards (categories: OSTRZEGAWCZE, ZAKAZU, NAKAZU, INFORMACYJNE, KIERUNKU, UZUPELNIAJACE, POZIOME)
- GET /flashcards/review?count=10 → flashcards due for SR review
- POST /flashcards/{id}/review — body: {quality: 0-5} → returns SR update info

### Readiness Predictor
- GET /readiness?category=B → returns {category, exams_taken, ema, variance, stability_penalty, readiness_score, status, last_scores, message}
  - status is one of: "GOTOWY", "PRAWIE_GOTOWY", "W_TRAKCIE_NAUKI", "WYMAGA_WIECEJ_NAUKI"

### Gamification
- GET /gamification/profile → returns {total_points, level, exams_taken, exams_passed, questions_answered, questions_correct, accuracy_percent, current_streak, best_streak, last_activity_date, badges}
- GET /gamification/leaderboard?limit=10 → returns list of {username, total_points, level, exams_passed}

### Intersections (DAG Simulator)
- GET /intersections → list all scenarios [{id, name, description, difficulty, image_filename}]
- GET /intersections/{id} → scenario with vehicles [{id, name, description, difficulty, scenario_data, vehicles: [{id, vehicle_label, vehicle_type, direction_from, direction_to, position_description}]}]
- POST /intersections/{id}/solve — body: {order: ["Karetka", "Tramwaj", "A", "B"]} → returns {is_correct, submitted_order, violations: [{yielding_vehicle, priority_vehicle, rule, message}], correct_order_example}
- GET /intersections/{id}/hint → returns {scenario_id, hint_type, hint, vehicles_that_go_first}

### Intersection Scenarios in DB:
1. Scenario 1 (EASY): 2 cars, equal intersection, right-hand rule. Vehicles: A (S→E), B (E→W). Correct: B first.
2. Scenario 2 (EASY): T-junction with yield sign. Vehicles: A (subordinate, S→E), B (priority road, W→E). Correct: B first.
3. Scenario 3 (MEDIUM): Equal intersection with tram. Vehicles: Tramwaj (N→S), A (W→E), B (S→W). Correct: Tramwaj > A > B.
4. Scenario 4 (MEDIUM): Roundabout with 3 vehicles. Vehicles: A (on roundabout), B (entering N), C (entering S). Correct: A first, then B and C.
5. Scenario 5 (HARD): Emergency vehicle + tram + 3 cars. Vehicles: Karetka (N→S), Tramwaj (E→W), A (W→E), B (S→N), C (E→N). Correct: Karetka > Tramwaj > C > B > A.
6. Scenario 6 (HARD): Priority road with curve. Vehicles: A (priority S→E), B (priority E→S), C (subordinate N→W), D (subordinate W→N). Correct: A and B first (priority road), then D, then C.

Vehicle types: CAR, TRAM, EMERGENCY, TRUCK, BICYCLE, PEDESTRIAN, USER

## Pages & Components

### 1. Auth Pages (Login / Register)
- Clean login form with username + password
- Register form with username + email + password
- Store JWT token in React state/context (NOT localStorage — blocked in iframe)
- Auto-redirect to dashboard after login

### 2. Dashboard (Main Screen) — route: /
- **Readiness Score Widget**: Large circular/radial progress showing readiness_score percentage. Color-coded by status. Show EMA value, variance, and status text in Polish.
- **Quick Stats Cards**: Questions answered, accuracy, exams taken/passed, current streak
- **Navigation Cards** to all modes: Egzamin, Ćwiczenia, Fiszki, Skrzyżowania
- **Recent Exam History**: Last 3-5 exams with scores
- **Gamification Bar**: Level, XP progress to next level, badges earned

### 3. Official Exam Mode — route: /exam
- **Start screen**: "Rozpocznij egzamin" button with exam rules summary (32 pytania, 25 minut, 68/74 pkt)
- **Exam screen**:
  - Timer counting down from 25:00 (auto-submit when time runs out)
  - Question counter: "Pytanie 1/32"
  - Question text prominently displayed
  - For TAK_NIE: Two large buttons "TAK" and "NIE"
  - For ABC: Three option buttons with answer text
  - Navigation: Next button (no going back, per real exam rules)
  - Points indicator per question (1/2/3 pkt)
  - Scope indicator (Podstawowy/Specjalistyczny)
- **Results screen**:
  - Large pass/fail indicator with animation
  - Score: X/74 points
  - Breakdown: correct/incorrect per section
  - Review of each question with user answer and correct answer
  - "Spróbuj ponownie" and "Wróć do menu" buttons

### 4. Single Questions Mode — route: /practice
- Get random question from API
- Display question, wait for answer
- Immediately show result after answering:
  - Green flash + checkmark for correct
  - Red flash + X for incorrect, show correct answer
  - Show explanation text
  - Points awarded
- "Następne pytanie" button to load next
- Stats sidebar: questions answered today, accuracy, streak

### 5. Flashcards Module — route: /flashcards
- **Category selector**: Tabs or pills for sign categories (Ostrzegawcze, Zakazu, Nakazu, etc.)
- **Flashcard component**:
  - 3D flip card animation (CSS transform)
  - Front: Sign code (e.g. "A-1") and sign name
  - Back: Full description and category
  - Self-rating buttons (0-5) after flipping:
    - 0-1: "Nie wiem" (red)
    - 2-3: "Częściowo" (yellow)
    - 4-5: "Wiem" (green)
  - This rating feeds into the SM-2 spaced repetition system
- **Review mode**: Show flashcards due for review based on SR scheduling
- **Browse mode**: Browse all flashcards by category

### 6. Intersection Simulator — route: /intersections
- **Scenario list**: Cards showing all scenarios with difficulty badges (Łatwy/Średni/Trudny)
- **Scenario view**:
  - SVG/Canvas visualization of intersection from bird's-eye view
  - Draw roads as gray rectangles forming a cross/T/roundabout
  - Show vehicles as colored rectangles/icons at their positions:
    - Cars: blue rectangles
    - Tram: orange/yellow rectangle, longer
    - Emergency: red rectangle with siren indicator
    - User's car: green rectangle
  - Show direction arrows on each vehicle
  - Labels on each vehicle (A, B, C, Tramwaj, Karetka)
  - Road signs shown if applicable
  - Direction indicators (N/S/E/W compass)
- **Interaction**:
  - User clicks vehicles in the order they should pass
  - Clicked vehicles get numbered (1, 2, 3...)
  - "Sprawdź" (Check) button to submit
  - Undo last click button
  - Reset button
- **Result display**:
  - If correct: Green success message with animation
  - If wrong: Red error with specific violations rendered:
    - For each violation: "Pojazd X musiał ustąpić pojazdowi Y ze względu na: [rule]"
    - Show correct order example
  - "Podpowiedź" (Hint) button that calls the hint API
- **Visual drawing approach**: Use a React component that renders SVG. Each scenario type (4-way, T-junction, roundabout) has a layout template. Vehicles are positioned based on direction_from.

### 7. Gamification Profile — route: /profile
- Level display with XP bar
- Points breakdown
- Badge collection (earned badges highlighted, unearned grayed out)
- Stats: exams, questions, streaks, accuracy
- Leaderboard table

## Layout & Navigation
- **Sidebar navigation** (collapsible on mobile → hamburger menu):
  - Logo + App name "Prawo Jazdy" at top
  - Nav items with icons:
    - Dashboard (LayoutDashboard icon)
    - Egzamin (FileCheck icon)
    - Ćwiczenia (BookOpen icon)
    - Fiszki (Layers icon)
    - Skrzyżowania (GitFork icon)
    - Profil (User icon)
  - Current user info + logout at bottom

## State Management
- Use React Context for auth state (token, user info)
- Use TanStack Query for all API data fetching
- Auth token stored in memory (React state), attached to all API requests via Authorization header

## Important Implementation Notes
1. ALL UI TEXT must be in POLISH
2. Use `useHashLocation` from `wouter/use-hash-location` for routing
3. No localStorage/sessionStorage/cookies (iframe sandbox blocks them)
4. Every interactive element needs `data-testid`
5. Dark mode support via Tailwind `dark:` classes
6. Mobile-responsive with sidebar collapsing to hamburger
7. Use shadcn/ui components throughout (Card, Button, Badge, Progress, Tabs, etc.)
8. Use lucide-react icons
9. Use recharts for any charts (exam history, readiness trend)
10. The Express backend proxies ALL `/api/*` requests to FastAPI on port 8000 — prefix all backend calls with `/api`
</content>
</invoke>