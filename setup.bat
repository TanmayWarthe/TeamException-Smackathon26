@echo off
title CTIP Setup
echo ==========================================================
echo   CTIP - Complete Environment Setup (Windows)
echo ==========================================================

cd /d "%~dp0"

echo 1. Setting up Python virtual environment...
python -m venv venv
call venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
pip install -r requirements-ai.txt

echo.
echo 2. Installing Frontend dependencies...
cd frontend
call npm install
cd ..

echo.
echo 3. Building Extension...
cd extension
call npm install
node build.mjs
cd ..

echo.
echo ==========================================================
echo   [OK] Setup Completed Successfully!
echo   Run 'run.bat' to start the application.
echo ==========================================================
pause
