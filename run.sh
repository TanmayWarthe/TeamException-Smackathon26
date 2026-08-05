#!/bin/bash
# ==========================================================
# CTIP (Campus Threat Intelligence Platform) Quick Launcher
# ==========================================================

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

echo "=========================================================="
echo "🛡️  Campus Threat Intelligence Platform (CTIP)"
echo "=========================================================="

# 1. Check Python virtual environment
if [ ! -d "venv" ]; then
    echo "⚠️  Virtual environment not found. Running initial setup..."
    bash scripts/setup.sh
fi

# Detect Python venv binary path (Linux/macOS vs Windows Git Bash)
if [ -f "./venv/bin/uvicorn" ]; then
    UVICORN_BIN="./venv/bin/uvicorn"
elif [ -f "./venv/Scripts/uvicorn.exe" ]; then
    UVICORN_BIN="./venv/Scripts/uvicorn.exe"
else
    UVICORN_BIN="uvicorn"
fi

# 2. Check frontend node_modules
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

echo ""
echo "🚀 Starting CTIP Services..."
echo "----------------------------------------------------------"
echo "🔹 Backend API:     http://localhost:8000"
echo "🔹 API Docs:        http://localhost:8000/docs"
echo "🔹 Frontend App:    http://localhost:5173"
echo "🔹 Login:           admin@ycce.edu.in  /  password123"
echo "----------------------------------------------------------"
echo "Press Ctrl+C to stop all services."
echo ""

# Start backend
$UVICORN_BIN backend.app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Start frontend
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Cleanup handler on exit (Ctrl+C)
cleanup() {
    echo ""
    echo "🛑 Stopping CTIP services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup INT TERM EXIT
wait
