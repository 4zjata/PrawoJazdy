# Prawo Jazdy - Projekt Egzaminacyjny

Pełnoskładkowa aplikacja do nauki na polskie prawo jazdy, zawierająca bazę pytań, fiszki oraz symulację skrzyżowań.

## 🚀 Technologie
- **Frontend**: React + Vite + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python)
- **Baza danych**: SQLite (SQLAlchemy + Alembic)
- **Infrastruktura**: Docker + Nginx

## 🛠 Instalacja lokalna

### 1. Backend
```bash
cd prawo_jazdy_backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 2. Frontend
```bash
cd prawo-jazdy-app
npm install
npm run dev
```

## 🐳 Konteneryzacja (Docker)
Projekt jest zoptymalizowany do działania w jednym kontenerze Docker. Aby go uruchomić:
```bash
docker-compose up -d --build
```

## 🌐 Wdrożenie (VPS)
Szczegółowe instrukcje dotyczące wdrażania na serwerze OVH z własną domeną znajdują się w pliku `WALKTHROUGH.md` (lub Twojej dokumentacji wewnętrznej).

## 📁 Struktura projektu
- `/prawo-jazdy-app` - Aplikacja kliencka (React)
- `/prawo_jazdy_backend` - API i logika biznesowa
- `docker-compose.yml` - Konfiguracja kontenerów
- `nginx.conf` - Konfiguracja serwera proxy
