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
    if exist "requirements-ai.txt" (
        pip install -r requirements-ai.txt
    )
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

:: 3. Check browser extension build
if not exist "extension\dist\manifest.json" (
    echo [!] Building Browser Extension...
    cd extension
    call npm install
    node build.mjs
    cd ..
)

:: 4. Seed baseline dataset if needed
if exist "scripts\import_twin_dataset.py" (
    echo [!] Checking Digital Twins dataset...
    python scripts\import_twin_dataset.py
)

echo.
echo ==========================================================
echo   Starting CTIP Services...
echo ----------------------------------------------------------
echo   Backend API:             http://localhost:8000
echo   API Docs:                http://localhost:8000/docs
echo   Frontend App:            http://localhost:5173
echo   Demo Phishing Site:      http://localhost:8088
echo   Default Login:           admin@ycce.edu.in  /  password123
echo ==========================================================
echo.

:: Start Backend in a separate window
start "CTIP Backend (Port 8000)" cmd /k "cd /d %~dp0 && call venv\Scripts\activate.bat && set PYTHONPATH=%~dp0 && python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload"

:: Start Frontend in a separate window
start "CTIP Frontend (Port 5173)" cmd /k "cd /d %~dp0\frontend && npm run dev"

:: Start Demo Phishing Server in a separate window
if exist "demo\phishing_site" (
    start "CTIP Demo Phishing Site (Port 8088)" cmd /k "cd /d %~dp0\demo\phishing_site && python -m http.server 8088"
)

echo [OK] All CTIP servers have been launched!
pause
