# NEXTALLOC — FINAL LIVE RELEASE ACCEPTANCE & DEMONSTRATION REPORT
**SIH25033 AI-Based Smart Internship Allocation Engine**
**Release Candidate Verification & Demonstration Certification**

---

## 1. RELEASE IDENTITY & PLATFORM INTEGRITY

| Attribute | Verified Setting / Hash | Status |
| :--- | :--- | :--- |
| **Workspace** | `C:\Users\shiva\Programming Projects\NextAlloc-PatchLab` | Verified Authorized |
| **Protected Base** | `C:\Users\shiva\Programming Projects\AllocateAI` | Strictly Read-Only / Untouched |
| **Active Git Branch** | `fix/allocator-correctness-lab` | Verified |
| **Distribution HEAD** | `f1ebddd` (`build(frontend): bundle latest production frontend assets`) | Clean & Verified |
| **Backend Runtime** | Spring Boot 3.4.1 (Java 17, Port 8086) | Healthy (`{"status":"UP","aiService":"UP"}`) |
| **AI Matching Engine** | FastAPI + Uvicorn (Python 3.11.9, OR-Tools CP-SAT, Ports 8000/8001) | Healthy (`{"status":"UP"}`) |
| **Database Engines** | Docker PostgreSQL 16 (Port 5439) + Spring Boot H2 | Migrations V1–V7 Verified |
| **Frontend Bundle** | Vite Production Distribution (`index-tI1aU37Y.js`, 1,025,517 bytes) | Served Directly by Spring Boot (`/`) |

### Verified Git Checkpoints

1. `bda6045` — **Checkpoint 1 (V6 Schema & Related Skills)**: `V6__candidate_related_skills.sql`, `CandidateRelatedSkill` entity, repository, and additive NLP endpoint contract.
2. `b651d1b` — **Checkpoint 2 (Semantic Soft Suitability)**: Opt-in related concept scoring with strict retention of mandatory eligibility gating.
3. `b5ff5e9` — **Checkpoint 3 (Durable Offer Lifecycle & Reallocation)**: `V7__offer_lifecycle.sql`, pessimistic row locking on opportunity capacity, offer state machine (`OFFERED` -> `ACCEPTED` -> `JOINED`), and reallocation diff calculation.
4. `a9ec407` — **Checkpoint 4 (Unified Product Interfaces)**: Student actionable offer cards, employer candidate offers modal, and admin run offers/movements tabs.
5. `f1ebddd` — **Checkpoint 5 (Frontend Distribution Bundle)**: Production build compiled and packaged directly into Spring Boot static distribution.

---

## 2. AUTOMATED BROWSER END-TO-END VERIFICATION (JOURNEYS A – F)

Real browser automation executed via Playwright using system Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`) across three isolated concurrent browser contexts (`candContext`, `provContext`, `adminContext`).

### Summary of Journey Results

| Journey | Description | Result | Key Evidence |
| :--- | :--- | :---: | :--- |
| **Journey A** | Successful Allocation Lifecycle | **PASSED** | Offer #19 generated -> Accepted by Aarav Sharma -> Confirmed `JOINED` by Employer |
| **Journey B** | Decline and Reallocation | **PASSED** | Reallocation Run #13 spawned from Run #12; 1 removed, 1 added; Joined seat preserved |
| **Journey C** | Mandatory Eligibility (Spring Boot != Java) | **PASSED** | Candidate with Spring Boot but no Java strictly rejected: `"Required Java skill is missing."` |
| **Journey D** | Truthful Infeasibility Handling | **PASSED** | Run #14 with `full_coverage` reported `Infeasible allocation` with 0 assignments published |
| **Journey E** | Multi-Run Inventory & Concurrency | **PASSED** | Run 12 offers (3) and Run 13 offers (3) maintain separate immutable ledgers |
| **Journey F** | Role-Based Authorization Boundaries | **PASSED** | 401 Unauthorized and 403 Forbidden verified across unauthenticated, candidate, and provider roles |

---

## 3. LIFECYCLE AUDIT TRAIL & RUN EVIDENCE

### Journey A: Global Allocation & Joining Flow
- **Allocation Run:** Run #12 (Policy: Balanced Allocation Policy, Solver: `Optimal allocation`, Total Runtime: 24ms).
- **Generated Offer:** Offer #19 (`Java Backend Engineering Intern`, Opportunity #106, Provider: `National Technology Institute`, Capacity: 2).
- **Candidate Action:** Candidate Aarav Sharma accepted offer. Status transitioned from `OFFERED` to `ACCEPTED`.
- **Employer Action:** Provider verified acceptance and confirmed placement. Status transitioned from `ACCEPTED` to `JOINED`.
- **Concurrency Protection:** Verified pessimistic row lock (`SELECT ... FOR UPDATE`) prevents oversubscription past capacity 2.

### Journey B: Reallocation & Placements Preservation
- **Parent Run:** Run #12 (`baseRunId: 12`).
- **Trigger Event:** Candidate Rohan Gupta (Candidate #703) withdrawn from allocation (`WITHDRAW_CANDIDATE`).
- **Child Run:** Reallocation Run #13 (`RUN-5bca7589`, Solver: `Optimal allocation`, Total Runtime: 31ms).
- **Movements Diff:**
  - `removed: 1` (Candidate #703 withdrawn).
  - `added: 1` (Candidate #702 Ananya Verma allocated to newly freed seat).
  - `unchanged: 2` (Candidate #704 Diya Patel and Candidate #701 Aarav Sharma).
- **Preservation Invariant:** Candidate Aarav Sharma's Offer #19 remained strictly in `JOINED` status without perturbation.

### Journey C: Mandatory Eligibility Strictness
- **Scenario:** Candidate declared `SQL`, `Web Development`, and related framework `Spring Boot` without canonical `Java`.
- **Target Opportunity:** Opportunity #106 (`Java Backend Engineering Intern`, Mandatory: `Java`, Optional: `SQL`, `Spring Boot`).
- **Evaluator Output:** `eligible: false`.
- **Reason Recorded:** `"Required Java skill is missing."`.
- **Conclusion:** Proves that experimental semantic soft suitability cannot bypass mandatory eligibility gating.

### Journey D: Truthful Infeasibility Handling
- **Allocation Run:** Run #14 (Policy: `full_coverage` under capacity constraint).
- **Solver Outcome:** `Infeasible allocation`.
- **Published Assignments:** `0`.
- **Conclusion:** NextAlloc never invents phantom placements or conceals mathematical solver infeasibility.

---

## 4. SCREENSHOTS & TRACE EVIDENCE

All screenshots captured from live headless Chrome browser sessions:

| Index | Name | Description | File Path |
| :---: | :--- | :--- | :--- |
| **01** | `01_candidate_dashboard_initial.png` | Candidate dashboard showing profile readiness after login | `screenshots/01_candidate_dashboard_initial.png` |
| **02** | `02_candidate_profile_ready.png` | Profile with academic declaration, NOC, skills, and related concepts | `screenshots/02_candidate_profile_ready.png` |
| **03** | `03_admin_runs_page.png` | Admin allocation runs management dashboard | `screenshots/03_admin_runs_page.png` |
| **04** | `04_admin_run_offers_tab.png` | Admin Run #12 Offers & Lifecycle tab showing generated offers | `screenshots/04_admin_run_offers_tab.png` |
| **05** | `05_candidate_home_offers_received.png` | Candidate dashboard displaying Actionable Internship Offers card | `screenshots/05_candidate_home_offers_received.png` |
| **06** | `06_candidate_offer_accepted.png` | Candidate offer accepted — seat locked (`ACCEPTED`) | `screenshots/06_candidate_offer_accepted.png` |
| **07** | `07_provider_opportunities.png` | Employer opportunities management list with Offers modal buttons | `screenshots/07_provider_opportunities.png` |
| **08** | `08_provider_offers_modal.png` | Employer Candidate Offers modal displaying accepted candidate | `screenshots/08_provider_offers_modal.png` |
| **09** | `09_provider_joining_confirmed.png` | Employer confirmed joining — candidate marked `JOINED` | `screenshots/09_provider_joining_confirmed.png` |
| **10** | `10_reallocation_movements.png` | Reallocation Run #13 movements tab displaying parent-child diff | `screenshots/10_reallocation_movements.png` |
| **11** | `11_infeasible_run_truthful.png` | Run #14 truthfully reporting solver status as Infeasible (0 assignments) | `screenshots/11_infeasible_run_truthful.png` |

---

## 5. COMPREHENSIVE TEST SUITE INVARIANTS

| Subsystem | Command | Passed | Failed | Errors | Status |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Java Backend** | `mvn test` | **307** | 0 | 0 | **PASSED** |
| **Python NLP (Lane 1)** | `pytest app/ai-service/tests` | **50** | 0 | 0 | **PASSED** |
| **Python Historical (Lane 2)** | `pytest pinned_commit_24aa965` | **2** | 0 | 0 | **PASSED** |
| **Frontend TypeScript** | `tsc --noEmit` | **0 errors** | 0 | 0 | **PASSED** |
| **Frontend Contracts** | `vitest run` | **9** | 0 | 0 | **PASSED** |
| **PostgreSQL 16 V1–V7** | `python test_postgres_v7.py` | **5** | 0 | 0 | **PASSED** |
| **Browser E2E (Journeys A–F)**| `node live_release_browser_e2e.cjs`| **6** | 0 | 0 | **PASSED** |

---

## 6. REPEATABLE SIH LIVE DEMONSTRATION SCRIPT

### Access Information
- **Application URL:** [http://127.0.0.1:8086/](http://127.0.0.1:8086/)
- **API Swagger Docs:** [http://127.0.0.1:8086/swagger-ui.html](http://127.0.0.1:8086/swagger-ui.html)
- **FastAPI Health:** [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

### Demo Credentials
1. **Administrator:** `admin@pragati.gov.in` / `Admin@123`
2. **Organisation / Employer:** `provider@pragati.gov.in` / `Provider@123`
3. **Student / Candidate:** `candidate@pragati.gov.in` / `Candidate@123`

### 4-Minute Presentation Sequence for Evaluators
1. **Act 1: Candidate Declaration & Institutional NOC (1 min)**
   - Sign in as Candidate (`candidate@pragati.gov.in`).
   - Navigate to **Profile**: show Academic Record (`VERIFIED_FINAL_YEAR`), institutional NOC upload with digital signature verification, and Skills breakdown distinguishing Canonical Skills (`Java`, `SQL`) from Related Frameworks (`Spring Boot`).
   - Highlight the notice explaining that related skills enhance suitability ranking but do not replace mandatory requirements.
2. **Act 2: Administrator Governance & Verification (1 min)**
   - Sign in as Admin (`admin@pragati.gov.in`).
   - Navigate to **Verification**: show registrar audit approval and NOC verification with audit comments.
   - Navigate to **Runs**: show global CP-SAT solver results, timing breakdowns, and the dedicated **Offers & Lifecycle** tab.
3. **Act 3: Student Offer Acceptance & Employer Joining Confirmation (1 min)**
   - Sign in as Candidate: show the **Actionable Internship Offers** card on the dashboard.
   - Click **Accept Seat** -> status locks to `ACCEPTED`.
   - Sign in as Employer (`provider@pragati.gov.in`): navigate to **Opportunities**, open **Offers Modal**, and click **Confirm Joining** -> status updates to `JOINED`.
4. **Act 4: Safe Reallocation & Truthful Infeasibility (1 min)**
   - Sign in as Admin: navigate to Reallocations.
   - Demonstrate Run #13 diff: show that Candidate #703's seat was reallocated to Candidate #702 while Candidate #701's joined offer remained untouched.
   - Show Run #14: show that an over-constrained full-coverage run truthfully reports `Infeasible allocation` with 0 assignments, never inventing false placements.

---

## 7. SIH DEMONSTRATION CERTIFICATION STATEMENT

```
========================================================================================
NEXTALLOC SIH LIVE DEMO — GO
========================================================================================
All core requirements, multi-actor workflows, database migrations V1 through V7,
concurrency locks, strict eligibility invariants, semantic soft suitability guards,
reallocation diff calculations, and browser end-to-end journeys have executed
successfully and are certified for live presentation.
========================================================================================
```

