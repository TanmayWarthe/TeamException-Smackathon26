#!/bin/bash
# CTIP Development Launch Script

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "Starting CTIP Backend Server on http://localhost:8000..."
./venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

echo "Starting CTIP Frontend Dashboard on http://localhost:5173..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo "CTIP services running. Press Ctrl+C to stop."
trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
