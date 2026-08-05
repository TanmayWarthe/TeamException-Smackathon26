# 🛡️ Campus Threat Intelligence Platform (CTIP)

AI-driven defense system against campus credential phishing, visual brand spoofing, and domain impersonation.

---

## ⚡ Quick Start (1-Command Run)

### 🐧 Linux & macOS
1. Open your terminal in the project directory.
2. Run:
   ```bash
   ./run.sh
   ```
   *(On first run, it will automatically set up Python venv, install packages, and launch both Backend and Frontend).*

---

### 🪟 Windows
1. Double-click **`run.bat`** or run in Command Prompt / PowerShell:
   ```cmd
   run.bat
   ```
   *(It will automatically configure Python venv, install npm packages, and start Backend and Frontend in separate windows).*

---

## 🌐 URLs & Default Login Credentials

| Service | URL | Description |
| :--- | :--- | :--- |
| **Frontend Dashboard** | [http://localhost:5173](http://localhost:5173) | Main security analyst UI & alerts |
| **Backend API** | [http://localhost:8000](http://localhost:8000) | FastAPI core engine |
| **API Documentation** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive Swagger UI |
| **Alternative Docs** | [http://localhost:8000/redoc](http://localhost:8000/redoc) | ReDoc API specification |

### 🔑 Default Admin Account
- **Email:** `admin@ycce.edu.in`
- **Password:** `password123`

---

## 🧩 Browser Extension Setup (Optional)

CTIP includes real-time browser protection for students & staff:

### Chrome / Brave / Edge
1. Navigate to `chrome://extensions/`
2. Turn on **Developer mode** (top right switch).
3. Click **Load unpacked**.
4. Select the `extension/dist` folder in this repository.

### Mozilla Firefox
1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select `extension/dist-firefox/manifest.json`.

---

## 🛠️ Manual Setup & Individual Commands

If you prefer running services manually in separate terminals:

### 1. Initial Setup
```bash
# Linux / macOS
bash scripts/setup.sh

# Windows
setup.bat
```

### 2. Run Backend
```bash
# Linux / macOS
./venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload

# Windows
venv\Scripts\activate
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Run Frontend
```bash
cd frontend
npm run dev
```

---

## 🧪 Running Tests

```bash
# Run backend test suite
./venv/bin/pytest

# Test AI similarity & Digital Twin pipeline
./venv/bin/python scripts/test_ai_pipeline.py
```

---

## 📂 Project Architecture

```
Campus-Threat-Intelligence/
├── backend/            # FastAPI backend server & SQLite database
│   ├── app/
│   │   ├── api/        # REST endpoints (auth, threats, digital twins, analyze)
│   │   ├── services/   # AI orchestration & database services
│   │   └── models/     # Database entities & schemas
├── frontend/           # React + Vite dashboard UI (Tailwind CSS, Recharts)
├── extension/          # Chrome/Firefox browser security extension
├── ai-engine/          # CLIP visual & layout similarity models
├── digital-twin/       # Institutional website fingerprinting engine
├── crawler/            # Discovery & Playwright web crawler
├── scripts/            # Development, testing, and migration utilities
├── run.sh              # 🚀 1-Click launcher for Linux / Mac
└── run.bat             # 🚀 1-Click launcher for Windows
```

---

## ❓ Troubleshooting

- **Port 8000 or 5173 already in use:**
  - Check if previous instances are running: `lsof -i :8000` or `lsof -i :5173` and kill them.
- **Python requirements issue:**
  - Make sure you are using Python 3.10 or higher (`python --version`).
- **Node requirements issue:**
  - Make sure Node.js v18 or higher is installed (`node -v`).
