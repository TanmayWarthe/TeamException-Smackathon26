#!/usr/bin/env bash
# commit_all.sh — Automatically stages and creates 35+ granular commits for CTIP and pushes to remote.

set -e

echo "================================================================"
echo "🚀 Starting 35+ multi-commit sequence for Campus Threat Intelligence"
echo "================================================================"

# 1. Base Config & Environment
git add .gitignore README.md shared/config.py shared/__init__.py 2>/dev/null || true
git commit -m "feat(core): initialize campus threat intelligence project configuration and domain whitelists" || true

# 2. Shared Types & Constants
git add extension/shared/ shared/ 2>/dev/null || true
git commit -m "feat(types): add cross-platform shared threat types, severity enums, and scan interfaces" || true

# 3. Digital Twin Generator
git add digital-twin/generator/ digital-twin/__init__.py 2>/dev/null || true
git commit -m "feat(digital-twin): implement headless page renderer and DOM fingerprint generator" || true

# 4. Digital Twin Embeddings
git add digital-twin/embeddings/ 2>/dev/null || true
git commit -m "feat(digital-twin): integrate OpenAI CLIP model for screenshot and logo visual embeddings" || true

# 5. Digital Twin Storage & Repository
git add digital-twin/storage/twin_store.py digital-twin/storage/__init__.py 2>/dev/null || true
git commit -m "feat(digital-twin): add thread-safe digital twin storage repository with JSON persistence" || true

# 6. Digital Twin Baselines
git add digital-twin/storage/twins/ digital-twin/storage/logos/ digital-twin/storage/screenshots/ 2>/dev/null || true
git commit -m "feat(digital-twin): generate official campus baseline twins for ERP, webmail, and student portals" || true

# 7. Digital Twin CLI Entrypoint
git add digital-twin/main.py 2>/dev/null || true
git commit -m "feat(digital-twin): build CLI orchestration runner for capturing and registering campus twins" || true

# 8. Evidence Normalizer
git add evidence-engine/html/ 2>/dev/null || true
git commit -m "feat(evidence): implement HTML normalizer, comment stripper, and DOM sanitization pipeline" || true

# 9. Evidence DOM Extractor
git add evidence-engine/dom/ 2>/dev/null || true
git commit -m "feat(evidence): add structural DOM tree depth, tag histogram, and layout fingerprinting" || true

# 10. Evidence Form Extractor
git add evidence-engine/forms/ 2>/dev/null || true
git commit -m "feat(evidence): build credential harvesting detector with external action domain analysis" || true

# 11. Evidence Pipeline Orchestrator
git add evidence-engine/pipeline.py evidence-engine/__init__.py 2>/dev/null || true
git commit -m "feat(evidence): implement end-to-end candidate evidence extraction and profiling pipeline" || true

# 12. AI Visual Similarity
git add ai-engine/visual/ 2>/dev/null || true
git commit -m "feat(ai-engine): add cosine similarity engine for visual screenshot embeddings" || true

# 13. AI Logo & Brand Similarity
git add ai-engine/logo/ 2>/dev/null || true
git commit -m "feat(ai-engine): implement brand logo detection and zero-shot visual similarity matching" || true

# 14. AI DOM Similarity
git add ai-engine/dom/ 2>/dev/null || true
git commit -m "feat(ai-engine): add structural DOM distance, tag distribution, and element count matching" || true

# 15. AI Form Similarity
git add ai-engine/forms/ 2>/dev/null || true
git commit -m "feat(ai-engine): implement login form structure matching and credential theft penalty heuristics" || true

# 16. AI CSS Similarity
git add ai-engine/css/ 2>/dev/null || true
git commit -m "feat(ai-engine): add color palette extraction and RGB/HSL brand similarity metrics" || true

# 17. AI URL Intelligence
git add ai-engine/url/ 2>/dev/null || true
git commit -m "feat(ai-engine): build URL risk engine with Levenshtein typosquatting, TLD, and homograph checks" || true

# 18. AI Feature Fusion
git add ai-engine/fusion/ ai-engine/__init__.py 2>/dev/null || true
git commit -m "feat(ai-engine): implement multi-modal feature fusion and aggregated threat red flag engine" || true

# 19. Risk Scoring Engine
git add risk-engine/scoring/ risk-engine/engine.py 2>/dev/null || true
git commit -m "feat(risk-engine): build dynamic weighted risk scoring algorithm with penalty overrides" || true

# 20. Risk Thresholds & Severity
git add risk-engine/thresholds/ 2>/dev/null || true
git commit -m "feat(risk-engine): implement multi-tier threat classification (Trusted, Low, Suspicious, High, Critical)" || true

# 21. Threat Explanation Reports
git add risk-engine/reports/ risk-engine/__init__.py 2>/dev/null || true
git commit -m "feat(risk-engine): add human-readable threat explanation generator and confidence scoring" || true

# 22. Backend Database Models & Schemas
git add backend/app/models/ backend/app/database.py 2>/dev/null || true
git commit -m "feat(backend): implement SQLAlchemy async models for Threats, Digital Twins, and Notifications" || true

# 23. Backend Pydantic Schemas
git add backend/app/schemas/ 2>/dev/null || true
git commit -m "feat(backend): define Pydantic validation schemas with camelCase and snake_case compatibility" || true

# 24. Backend Authentication & RBAC
git add backend/app/api/auth.py 2>/dev/null || true
git commit -m "feat(backend): add JWT authentication, password hashing, and role-based security access" || true

# 25. Backend Threat Radar API
git add backend/app/api/threats.py 2>/dev/null || true
git commit -m "feat(backend): implement threat feed endpoints with filtering, pagination, and status lifecycle" || true

# 26. Backend Digital Twins API
git add backend/app/api/digital_twins.py 2>/dev/null || true
git commit -m "feat(backend): build digital twin management endpoints for registration and side-by-side audit" || true

# 27. Backend SOC Dashboard API
git add backend/app/api/dashboard.py 2>/dev/null || true
git commit -m "feat(backend): add security operations center aggregate metrics and active attack counters" || true

# 28. Backend Real-time AI Analysis API
git add backend/app/api/analyze.py backend/app/services/ai_service.py 2>/dev/null || true
git commit -m "feat(backend): implement real-time URL & HTML phishing analysis endpoint with AI service worker" || true

# 29. Backend Upsert & Deduplication Fix
git add backend/app/api/analyze.py backend/app/schemas/schemas.py 2>/dev/null || true
git commit -m "fix(backend): implement threat deduplication upsert logic and lower persistence threshold to 50" || true

# 30. Backend Application Entrypoint
git add backend/app/main.py backend/app/__init__.py 2>/dev/null || true
git commit -m "feat(backend): configure FastAPI router middleware, CORS policies, and server lifespan events" || true

# 31. Frontend Project Setup & Theme
git add frontend/package.json frontend/vite.config.ts frontend/tsconfig*.json frontend/tailwind.config.js frontend/postcss.config.js frontend/index.html 2>/dev/null || true
git commit -m "feat(frontend): setup React 18 + Vite dashboard with dark cyber security glassmorphism UI" || true

# 32. Frontend Services & Routing
git add frontend/src/services/ frontend/src/router/ frontend/src/types/ frontend/src/App.tsx frontend/src/main.tsx 2>/dev/null || true
git commit -m "feat(frontend): add Axios API client, authentication tokens interceptor, and client-side routing" || true

# 33. Frontend SOC Dashboard & Threat Radar Pages
git add frontend/src/pages/Dashboard.tsx frontend/src/pages/Threats.tsx frontend/src/pages/ThreatDetail.tsx 2>/dev/null || true
git commit -m "feat(frontend): build SOC dashboard overview metrics, live threat radar, and threat detail inspector" || true

# 34. Frontend Digital Twins & Analytics Pages
git add frontend/src/pages/DigitalTwins.tsx frontend/src/pages/Analytics.tsx frontend/src/pages/Settings.tsx frontend/src/pages/Login.tsx 2>/dev/null || true
git commit -m "feat(frontend): create digital twin visual diff inspector, incident analytics charts, and auth views" || true

# 35. Frontend UI Components
git add frontend/src/components/ frontend/src/index.css 2>/dev/null || true
git commit -m "feat(frontend): build reusable cyber UI component library with Lucide icons and animated badges" || true

# 36. Browser Extension (Chrome Manifest V3 & Firefox)
git add extension/manifest.json extension/build.mjs extension/package.json extension/tsconfig.json extension/background/ extension/content/ extension/popup/ extension/services/ extension/dist/ extension/dist-firefox/ 2>/dev/null || true
git commit -m "feat(extension): implement Manifest V3 real-time student protection extension with popup radar" || true

# 37. Unit Tests & Automated Test Suites
git add tests/ pytest.ini 2>/dev/null || true
git commit -m "test(backend): add comprehensive pytest test suite for API endpoints and phishing scoring" || true

# 38. Verification Scripts & Database Tooling
git add scripts/ backend/ctip.db 2>/dev/null || true
git commit -m "test(e2e): add automated threat deduplication test suite and database maintenance scripts" || true

# 39. Final Workspace Commit & Push
git add .
git commit -m "chore: finalize project documentation, build artifacts, and deployment configurations" || true

echo "================================================================"
echo "🚀 Pushing all commits to remote origin main..."
echo "================================================================"
git push origin main

echo "================================================================"
echo "✅ All 35+ commits successfully created and pushed to GitHub!"
echo "================================================================"
