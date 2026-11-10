# NextAlloc SIH Live Demonstration Instructions

## Architecture Overview
- **Frontend SPA**: React 18 / TypeScript, built with Vite, served directly from Spring Boot (`http://127.0.0.1:8086/`).
- **Backend API**: Spring Boot 3.4.1 (Java 17) running on port `8086`.
- **AI Matching Engine**: FastAPI (Python 3.11.9) with OR-Tools CP-SAT running on port `8000` / `8001`.
- **Database Engine**: In-memory H2 (`jdbc:h2:mem:pragati`) with Flyway migrations V1–V7 for zero-dependency local demonstration. Verified against PostgreSQL 16 on container port `5439`.

---

## Access Information
- **Web UI**: [http://127.0.0.1:8086/](http://127.0.0.1:8086/)
- **Swagger Documentation**: [http://127.0.0.1:8086/swagger-ui.html](http://127.0.0.1:8086/swagger-ui.html)
- **AI Service Health**: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

---

## Demonstration Credentials (Local Demo Only)
> [!WARNING]
> These credentials are seeded solely for local, isolated presentation and must never be used in external environments.

| Role | Email | Password | Landing Route |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@pragati.gov.in` | `Admin@123` | `/admin/runs` |
| **Organisation Partner** | `provider@pragati.gov.in` | `Provider@123` | `/provider/opportunities` |
| **Student / Candidate** | `candidate@pragati.gov.in` | `Candidate@123` | `/candidate/home` |

---

## 4-Minute SIH Demo Presentation Script

### 1. Candidate Declaration & Institutional NOC (1 min)
1. Sign in as **Candidate** (`candidate@pragati.gov.in` / `Candidate@123`).
2. Navigate to **Profile**:
   - Show Academic Status (`VERIFIED_FINAL_YEAR`).
   - Show institutional NOC submission with digital verification.
   - Show skill taxonomy breakdown: **Canonical Skills** (`Java`, `SQL`) vs **Related Frameworks** (`Spring Boot`, `PostgreSQL`).
   - Highlight the banner: Related skills contribute to optional suitability ranking, but strictly do not replace mandatory eligibility requirements.

### 2. Admin Verification & CP-SAT Global Allocation (1 min)
1. Sign in as **Administrator** (`admin@pragati.gov.in` / `Admin@123`).
2. Navigate to **Verification**: Show registrar approval records and institutional NOC review.
3. Navigate to **Allocation Runs**: Show solver statistics, stage timings, and click into the latest run.
4. Open the **Offers & Lifecycle** tab: Show the generated durable offers (`OFFERED`).

### 3. Candidate Offer Acceptance & Employer Joining Confirmation (1 min)
1. In Candidate view, navigate to **Home**:
   - Show the **Actionable Internship Offers** card.
   - Click **Accept Seat** -> Offer status transitions to `ACCEPTED` and seat is locked against oversubscription.
2. Sign in as **Organisation Partner** (`provider@pragati.gov.in` / `Provider@123`).
3. Navigate to **Opportunities**, click **Offers** on Opportunity #106, and click **Confirm Joining** -> Offer status transitions to `JOINED`.

### 4. Reallocation & Infeasibility Handling (1 min)
1. Return to Administrator view, open **Reallocations**.
2. Show child run diff: demonstrate that a declined or withdrawn candidate's seat is reallocated to the next best candidate while the previously joined candidate's placement remains untouched.
3. Show infeasible run (#14): demonstrate that an over-constrained allocation reports `Infeasible allocation` truthfully with zero phantom assignments published.
