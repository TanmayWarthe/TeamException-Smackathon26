#!/bin/bash
# CTIP Complete Setup Script
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== CTIP Environment Setup ==="

# 1. Frontend setup
echo "1. Installing Frontend dependencies..."
cd frontend
npm install
cd ..

# 2. Extension setup & build
echo "2. Building Browser Extension..."
cd extension
npm install
node build.mjs
cd ..

# 3. Python environment & dependencies
echo "3. Setting up Python environment..."
python3 -m venv venv || true
./venv/bin/pip install -r backend/requirements.txt
./venv/bin/pip install -r requirements-ai.txt || true

echo "=== Setup Completed Successfully! ==="
