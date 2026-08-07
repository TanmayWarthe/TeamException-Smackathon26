#!/usr/bin/env bash
# ==============================================================================
# 🛡️ Campus Threat Intelligence Platform (CTIP) — Complete Launcher
# ==============================================================================
# Starts all services:
#   1. Backend API + WebSockets (FastAPI / Uvicorn on :8000)
#   2. Frontend SOC Dashboard (React + Vite on :5173)
#   3. Realistic Cloned Phishing Demo Site (Python HTTP Server on :8088)
#   4. Rebuilds Browser Extension (Chrome & Firefox in extension/dist/)
# ==============================================================================

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

# Color Codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}${BOLD}"
echo "========================================================================"
echo "🛡️   CAMPUS THREAT INTELLIGENCE PLATFORM (CTIP) — FULL STACK LAUNCHER"
echo "========================================================================"
echo -e "${NC}"

# ── 1. Python Environment Setup ───────────────────────────────────────────────
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}⚠️  Virtual environment not found. Creating venv and installing packages...${NC}"
    if [ -f "scripts/setup.sh" ]; then
        bash scripts/setup.sh
    else
        python3 -m venv venv
        ./venv/bin/pip install --upgrade pip
        ./venv/bin/pip install -r backend/requirements.txt
        if [ -f "requirements-ai.txt" ]; then
            ./venv/bin/pip install -r requirements-ai.txt
        fi
    fi
fi

# Detect Python & Uvicorn binaries
if [ -f "./venv/bin/python" ]; then
    PYTHON_BIN="./venv/bin/python"
    UVICORN_BIN="./venv/bin/uvicorn"
elif [ -f "./venv/Scripts/python.exe" ]; then
    PYTHON_BIN="./venv/Scripts/python.exe"
    UVICORN_BIN="./venv/Scripts/uvicorn.exe"
else
    PYTHON_BIN="python3"
    UVICORN_BIN="uvicorn"
fi

# ── 2. Frontend Dependencies Check ────────────────────────────────────────────
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${BLUE}📦 Installing frontend dependencies...${NC}"
    (cd frontend && npm install)
fi

# ── 3. Browser Extension Build ────────────────────────────────────────────────
echo -e "${BLUE}🧩 Checking and building Browser Extension...${NC}"
if [ ! -d "extension/node_modules" ]; then
    echo -e "${BLUE}📦 Installing extension dependencies...${NC}"
    (cd extension && npm install)
fi
(cd extension && npm run build >/dev/null 2>&1 || node build.mjs)
echo -e "${GREEN}✅ Browser extension built in extension/dist/${NC}"

# ── 4. Kill Any Stale Port Occupants ──────────────────────────────────────────
free_port() {
    local port=$1
    if command -v fuser >/dev/null 2>&1; then
        fuser -k "${port}/tcp" >/dev/null 2>&1 || true
    elif command -v lsof >/dev/null 2>&1; then
        local pid
        pid=$(lsof -ti tcp:"$port" 2>/dev/null || true)
        if [ -n "$pid" ]; then
            kill -9 $pid >/dev/null 2>&1 || true
        fi
    fi
}

echo -e "${BLUE}🧹 Ensuring ports 8000, 5173, and 8088 are free...${NC}"
free_port 8000
free_port 5173
free_port 8088

# ── 5. Seed Legitimate Domains Dataset if unseeded ─────────────────────────────
if [ -f "scripts/import_twin_dataset.py" ] && [ -f "legitimate_domains_dataset.json" ]; then
    echo -e "${BLUE}📦 Verifying Digital Twins baseline dataset...${NC}"
    $PYTHON_BIN scripts/import_twin_dataset.py >/dev/null 2>&1 || true
fi

# ── 6. Process Tracking & Graceful Shutdown Trap ───────────────────────────────
PIDS=()

cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down all CTIP services...${NC}"
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
        fi
    done
    # Free ports on exit
    free_port 8000
    free_port 5173
    free_port 8088
    echo -e "${GREEN}✨ All CTIP services stopped cleanly.${NC}"
    exit 0
}

trap cleanup INT TERM EXIT

# ── 7. Launch Services ────────────────────────────────────────────────────────

echo -e "\n${GREEN}${BOLD}🚀 Launching All CTIP Servers...${NC}\n"

# 1. Start Backend Server (FastAPI + WebSocket + AI Engine)
export PYTHONPATH="$REPO_ROOT"
$PYTHON_BIN -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
PIDS+=($BACKEND_PID)

# 2. Start Frontend SOC Dashboard (React / Vite)
(
    cd frontend
    npm run dev -- --host 0.0.0.0 --port 5173
) &
FRONTEND_PID=$!
PIDS+=($FRONTEND_PID)

# 3. Start Demo Cloned Phishing Server (Realistic Test Target)
if [ -d "demo/phishing_site" ]; then
    (
        cd demo/phishing_site
        python3 -m http.server 8088 >/dev/null 2>&1
    ) &
    DEMO_PID=$!
    PIDS+=($DEMO_PID)
fi

# ── 8. Status Dashboard & Quick Links ─────────────────────────────────────────
sleep 1.5
echo ""
echo -e "${CYAN}========================================================================${NC}"
echo -e "${BOLD}🌟 CTIP LIVE SERVICES DASHBOARD${NC}"
echo -e "${CYAN}========================================================================${NC}"
echo -e "🔹 ${BOLD}SOC Web Dashboard:${NC}        ${GREEN}http://localhost:5173${NC}"
echo -e "🔹 ${BOLD}Backend REST & WS API:${NC}    ${GREEN}http://localhost:8000${NC}"
echo -e "🔹 ${BOLD}Interactive API Docs (Swagger):${NC} ${GREEN}http://localhost:8000/docs${NC}"
if [ -d "demo/phishing_site" ]; then
echo -e "🔹 ${BOLD}Live Demo Phishing Portal:${NC} ${RED}http://localhost:8088${NC}"
fi
echo -e "------------------------------------------------------------------------"
echo -e "🔑 ${BOLD}Admin Credentials:${NC}"
echo -e "   • Email:    ${CYAN}admin@ycce.edu.in${NC}  (or soc-lead@ycce.edu.in / ciso@ycce.edu.in)"
echo -e "   • Password: ${CYAN}password123${NC}"
echo -e "------------------------------------------------------------------------"
echo -e "🧩 ${BOLD}Chrome / Edge Extension Setup:${NC}"
echo -e "   1. Open ${CYAN}chrome://extensions${NC} and enable 'Developer mode'"
echo -e "   2. Click 'Load unpacked' and select: ${YELLOW}$REPO_ROOT/extension/dist${NC}"
echo -e "   3. Open ${RED}http://localhost:8088${NC} to see live AI threat detection & blocking!"
echo -e "${CYAN}========================================================================${NC}"
echo -e "${YELLOW}Press [Ctrl+C] anytime to stop all servers.${NC}\n"

# Wait for background processes
wait
