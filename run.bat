@echo off
title Campus Threat Intelligence Platform (CTIP)
echo ==========================================================
echo   Campus Threat Intelligence Platform (CTIP)
echo ==========================================================

cd /d "%~dp0"

:: 1. Check Python virtual environment
if not exist "venv" (
    echo [!] Virtual environment not found. Setting up Python venv...
    python -m venv venv
    call venv\Scripts\activate.bat
    python -m pip install --upgrade pip
    pip install -r backend\requirements.txt
    pip install -r requirements-ai.txt
) else (
    call venv\Scripts\activate.bat
)

:: 2. Check frontend dependencies
if not exist "frontend\node_modules" (
    echo [!] Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)

echo.
echo ==========================================================
echo   Starting CTIP Services...
echo ----------------------------------------------------------
echo   Backend API:     http://localhost:8000
echo   API Docs:        http://localhost:8000/docs
echo   Frontend App:    http://localhost:5173
echo   Default Login:   admin@ycce.edu.in  /  password123
echo ==========================================================
echo.

:: Start Backend in a separate window or background
start "CTIP Backend (Port 8000)" cmd /k "cd /d %~dp0 && call venv\Scripts\activate.bat && uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload"

:: Start Frontend in a separate window
start "CTIP Frontend (Port 5173)" cmd /k "cd /d %~dp0\frontend && npm run dev"

echo [OK] Both Backend and Frontend have been launched in separate windows!
echo Keep those windows open while using the platform.
pause
