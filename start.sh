#!/bin/bash

# 1. Start FastAPI backend in the background
echo "Starting FastAPI backend and seeding database..."
cd /app/prawo_jazdy_backend
# Run seeder (it's idempotent, safe to run every time)
python3 seed_database.py
uvicorn app.main:app --host 0.0.0.0 --port 8000 &

# Start Express frontend proxy in the foreground
echo "Starting Express frontend on port 5000..."
cd /app/prawo-jazdy-app
# We use the built static files in production
npm run start
