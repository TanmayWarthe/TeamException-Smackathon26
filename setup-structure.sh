#!/bin/bash
# CTIP - Campus Threat Intelligence Platform
# Folder Structure Setup Script
# Run this from the root of your repo: bash setup-structure.sh

echo "Creating CTIP folder structure..."

# ---------- FRONTEND (Full-Stack Dev) ----------
mkdir -p frontend/public
mkdir -p frontend/src/{assets,components,pages,layouts,hooks,services,store,utils,styles,types,router,context,constants}
touch frontend/src/App.tsx
touch frontend/src/main.tsx
touch frontend/package.json
touch frontend/vite.config.ts

# ---------- BACKEND (Python Dev) ----------
mkdir -p backend/app/{api,auth,core,database,middleware,models,schemas,services,websocket,utils,config}
touch backend/app/main.py
touch backend/requirements.txt
touch backend/Dockerfile

# ---------- BROWSER EXTENSION (Full-Stack Dev) ----------
mkdir -p extension/{popup,background,content,services,storage,utils,assets,shared}
touch extension/manifest.json

# ---------- CRAWLER / THREAT DISCOVERY (Python Dev) ----------
mkdir -p crawler/{scheduler,discovery,renderer,screenshot,metadata,workers,queue}
touch crawler/main.py

# ---------- DIGITAL TWIN ENGINE (AI/ML Dev) ----------
mkdir -p digital-twin/{generator,extractor,embeddings,storage,updater}
touch digital-twin/main.py

# ---------- EVIDENCE EXTRACTION ENGINE (AI/ML Dev) ----------
mkdir -p evidence-engine/{html,dom,css,forms,javascript,screenshots,metadata}
touch evidence-engine/pipeline.py

# ---------- AI SIMILARITY ENGINE (AI/ML Dev) ----------
mkdir -p ai-engine/{visual,dom,css,forms,logo,ssl,javascript,fusion,explainability}
touch ai-engine/engine.py

# ---------- RISK SCORING ENGINE (AI/ML Dev) ----------
mkdir -p risk-engine/{scoring,confidence,thresholds,reports,notifications}
touch risk-engine/engine.py

# ---------- SHARED (everyone) ----------
mkdir -p shared/{dto,enums,interfaces,constants,helpers}

# ---------- INFRASTRUCTURE (Python Dev) ----------
mkdir -p infrastructure/{nginx,monitoring,logging,redis,postgres}

# ---------- DOCKER (Python Dev) ----------
mkdir -p docker/{backend,frontend,crawler,ai,postgres,redis}
touch docker/docker-compose.yml

# ---------- DOCS ----------
mkdir -p docs/{architecture,api,diagrams,database,research}

# ---------- SCRIPTS ----------
mkdir -p scripts
touch scripts/setup.sh
touch scripts/run-dev.sh
touch scripts/seed-db.py
touch scripts/migrate.py
touch scripts/clean.sh

# ---------- ROOT FILES ----------
touch .env.example
touch docker-compose.yml
touch README.md
touch LICENSE

echo "✅ CTIP folder structure created successfully!"
echo "Run 'find . -type d | sort' to view the structure."
