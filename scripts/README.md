# NextAlloc — QA Automation & Test Execution Guide

This directory contains the automated QA suites for NextAlloc (SIH25033), covering visual route auditing, browser end-to-end acceptance journeys, and transactional API cross-role verification.

All scripts are completely portable, fail-closed, free of hardcoded machine paths, and runnable against local disposable services.

---

## 1. Test Suites Overview

| Script | Type | Focus | Primary Target |
| :--- | :--- | :--- | :--- |
| `qa_all_routes.mjs` | Mocked UI Visual Suite | Multi-viewport route audit (Desktop 1440px, Tablet 768px, Mobile 360px/390px, Laptop 1366px), zero broken images, zero horizontal overflow, 22 canonical screenshots in `.stitch/redesign-final/` | Frontend (`:5173`) |
| `qa_real_browser_cross_role.mjs` | Real Browser Acceptance | Real React DOM interactions: Admin allocation run -> Candidate offer review & accept -> Hard reload persistence -> Provider joining confirm -> Hard reload persistence -> Candidate joined state | In-process test proxy (`:5174`) bridging UI (`:5173`) & Backend (`:18080`) |
| `qa_real_cross_role_e2e.mjs` | Headless API Transactional | Pure HTTP cross-role state mutations: JWT authentication, allocation run triggers, duplicate accept idempotency, provider offer inspection, joining transitions, and invalid transition guards | Spring Boot API (`:18080/api`) |

---

## 2. Prerequisites

- **Java 17+** (OpenJDK / Eclipse Temurin 17)
- **Python 3.10+** (with `fastapi`, `uvicorn`, `ortools` installed)
- **Node.js 18+** (Node v20+ recommended)
- **Google Chrome** or Playwright-managed Chromium

Dependencies for Playwright are resolved dynamically from `app/frontend/package.json` without requiring global npm installations.

---

## 3. Starting the Isolated Disposable Stack

To isolate tests from existing demonstration databases and environments, run the stack with disposable configurations:

### Step 1: Start Vite Frontend (Port 5173)
```powershell
cd app/frontend
npm run dev -- --port 5173 --strictPort
```

### Step 2: Start Python AI & CP-SAT Solver (Port 8000)
```powershell
cd app/ai-service
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

### Step 3: Start Spring Boot Backend on Disposable In-Memory H2 (Port 18080)
```powershell
java "-Dserver.port=18080" `
     "-Dspring.datasource.url=jdbc:h2:mem:nextalloc_disposable;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE" `
     "-Dnextalloc.ai.service-url=http://127.0.0.1:8000" `
     "-Dnextalloc.web.dev-origins=http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174" `
     -jar app/backend/target/nextalloc-backend.jar
```

Verify backend health:
```powershell
curl http://127.0.0.1:18080/api/health
# Returns: {"status":"UP","aiService":"UP"}
```

---

## 4. Running the Tests

From the repository root:

### Visual Route Audit & Screenshot Capture
```powershell
node scripts/qa_all_routes.mjs
```
*Outputs 22 screenshots to `.stitch/redesign-final/`.*

### Real Browser Cross-Role Journey
```powershell
node scripts/qa_real_browser_cross_role.mjs
```
*Automatically hosts the test proxy on port 5174, verifies stack health, drives Playwright through Admin, Candidate, and Provider sessions, and captures step-by-step verification screenshots to `.stitch/`.*

### Headless API Cross-Role Transaction Suite
```powershell
node scripts/qa_real_cross_role_e2e.mjs
```
*Validates the full offer lifecycle via raw HTTP requests and verifies business domain invariants.*

---

## 5. Environment Variables & Overrides

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `NEXTALLOC_UI_URL` | `http://127.0.0.1:5173` | Local Vite development server |
| `NEXTALLOC_BACKEND_URL` | `http://127.0.0.1:18080` | Spring Boot REST API server |
| `NEXTALLOC_AI_URL` | `http://127.0.0.1:8000` | FastAPI / OR-Tools optimization engine |
| `TEST_PROXY_PORT` | `5174` | Port for embedded reverse proxy |
| `SCREENSHOT_DIR` | `.stitch/redesign-final` | Target directory for generated PNG artifacts |
| `CHROME_PATH` | System Chrome | Path to Chrome/Chromium binary |
| `DEMO_ADMIN_EMAIL` | `admin@nextalloc.in` | Administrator persona |
| `DEMO_PROVIDER_EMAIL` | `provider@nextalloc.in` | Provider persona |
| `DEMO_CANDIDATE_EMAIL` | `candidate@nextalloc.in` | Candidate persona |

All scripts enforce fail-closed security guards and reject execution against non-loopback hosts.
