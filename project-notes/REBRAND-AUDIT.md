# NextAlloc Rebrand Audit — SIH25033
**Date:** 2026-11-03  
**Auditor:** Automated rebrand pipeline  
**Branch:** `feature/nextalloc-rebrand`  
**Baseline commit:** initial baseline before rebrand

---

## 1. Workspace Structure

```
AllocateAI/
├── app/                        ← Main application (PRAGATI → NextAlloc)
│   ├── ai-service/             ← Python FastAPI + OR-Tools optimizer
│   ├── backend/                ← Spring Boot Java 17
│   ├── frontend/               ← React 18 / TypeScript / Vite
│   ├── docs/                   ← Developer and judge documentation
│   ├── tools/                  ← e2e and measurement scripts
│   └── docker-compose.yml
├── Logo/
│   └── logo.png                ← Approved NextAlloc logo asset
├── project-notes/              ← Planning documents
└── source-references/          ← REFERENCE ONLY — do not modify
    ├── sih-bsod/               ← UI reference (separate repo)
    └── suyash-ml/              ← ML reference (separate repo)
```

---

## 2. PRAGATI Brand Occurrences Found

### 2.1 Frontend — `app/frontend/src/`

| File | Line | Content | Classification |
|------|------|---------|----------------|
| `api/client.ts` | 3 | `TOKEN_KEY = 'pragati_token'` | INTERNAL IDENTIFIER REQUIRING REFACTORING (localStorage key) |
| `components/ErrorBoundary.tsx` | 19 | `[PRAGATI] UI error boundary caught:` | SAFE PRODUCT-BRANDING CHANGE |
| `components/ErrorBoundary.tsx` | 35 | `The rest of PRAGATI is still running.` | SAFE PRODUCT-BRANDING CHANGE |
| `components/Logo.tsx` | 4,6,16,34,46,64 | Multiple PRAGATI references in JSDoc and rendered text | SAFE PRODUCT-BRANDING CHANGE |
| `pages/admin/RunDetail.tsx` | 189 | `PRAGATI-Report-Run${r.number}.pdf` | SAFE PRODUCT-BRANDING CHANGE |
| `pages/admin/RunDetail.tsx` | 328 | `PRAGATI global allocation` | SAFE PRODUCT-BRANDING CHANGE |
| `pages/admin/Scenarios.tsx` | 102 | `created by the PRAGATI seeder` | SAFE PRODUCT-BRANDING CHANGE |
| `pages/admin/WhatIf.tsx` | 116 | `PRAGATI default configurable weights` | SAFE PRODUCT-BRANDING CHANGE |
| `pages/candidate/Analytics.tsx` | 138 | `'PRAGATI default configurable weights'` | SAFE PRODUCT-BRANDING CHANGE |
| `pages/candidate/Profile.tsx` | 380 | `PRAGATI understand what you value` | SAFE PRODUCT-BRANDING CHANGE |
| `pages/candidate/Profile.tsx` | 433 | `PRAGATI finds your details and skills` | SAFE PRODUCT-BRANDING CHANGE |
| `pages/Login.tsx` | 9–11 | `@pragati.gov.in` emails (demo credentials) | SAFE PRODUCT-BRANDING CHANGE |
| `pages/Login.tsx` | 52 | `PRAGATI allocates every eligible…` | SAFE PRODUCT-BRANDING CHANGE |
| `pages/Login.tsx` | 71 | `Sign in to PRAGATI` | SAFE PRODUCT-BRANDING CHANGE |
| `App.tsx` | 33 | `Starting PRAGATI…` | SAFE PRODUCT-BRANDING CHANGE |
| `index.html` | — | Title, meta description containing PRAGATI | SAFE PRODUCT-BRANDING CHANGE |
| `package.json` | name, description | `pragati-frontend`, PRAGATI description | SAFE PRODUCT-BRANDING CHANGE |

### 2.2 Backend — `app/backend/src/`

| File | Classification | Action |
|------|---------------|--------|
| `in/pragati/**` — all Java package paths | INTERNAL IDENTIFIER — DEFER | Renaming 80+ Java files is high-risk; `in.pragati` package name is invisible to end users. Deferred. |
| `PragatiApplication.java` | INTERNAL IDENTIFIER — DEFER | Entry-point class; renaming requires build coordination. Deferred. |
| `config/AppProperties.java` — `@ConfigurationProperties(prefix = "pragati")` | CONFIGURATION CHANGE REQUIRING COORDINATION | The prefix matches `application.yml` keys. Must update both together or leave as-is. Deferred to preserve runtime compatibility. |
| `config/OpenApiConfig.java` — title, description, contact | SAFE PRODUCT-BRANDING CHANGE | Update display strings only. |
| `seed/PolicySeeder.java` — description strings | SAFE PRODUCT-BRANDING CHANGE |
| `seed/ScenarioSeeder.java` — `@pragati.gov.in` emails, hash seed string `"pragati|…"` | MIXED | Email domains → SAFE CHANGE. Hash seed string → INTERNAL IDENTIFIER, changing breaks determinism — DEFER. |
| `common/Weights.java` — Javadoc comment | SAFE PRODUCT-BRANDING CHANGE |
| `common/Labels.java` etc. — package declarations only | INTERNAL IDENTIFIER — DEFER |
| `application.yml` — `spring.application.name: pragati-backend`, `pragati:` config block prefix | CONFIGURATION CHANGE REQUIRING COORDINATION — DEFER (env var contract active) |
| `application.yml` — `pragati.jwt.secret` demo value | INTERNAL IDENTIFIER — PRESERVE (demo only, not a real secret) |
| `pom.xml` — `groupId: in.pragati`, `artifactId: pragati-backend`, `name`, `description` | MIXED — groupId/artifactId DEFER; name/description SAFE CHANGE |
| `backend/Dockerfile` | No PRAGATI strings — no change needed |

### 2.3 AI Service — `app/ai-service/`

| File | Line | Classification |
|------|------|---------------|
| `main.py` | 2, 25, 26 | SAFE PRODUCT-BRANDING CHANGE |
| `optimizer.py` | 2 | SAFE PRODUCT-BRANDING CHANGE |

### 2.4 Documentation — `app/docs/`

All docs reference PRAGATI throughout. Classification: **SAFE PRODUCT-BRANDING CHANGE** for display names. Technical content preserved.

### 2.5 Docker Compose — `app/docker-compose.yml`

| Item | Classification |
|------|---------------|
| Comment header `# PRAGATI` | SAFE PRODUCT-BRANDING CHANGE |
| Env var `PRAGATI_AI_URL`, `PRAGATI_STATIC_DIR`, `PRAGATI_UPLOADS_DIR` | CONFIGURATION CHANGE REQUIRING COORDINATION — DEFER (match `application.yml` `${PRAGATI_*}` references) |

### 2.6 Logo / Assets

| File | Status |
|------|--------|
| `app/frontend/public/logo.png` | OLD — served as-is; Logo/ folder contains approved NextAlloc logo |
| `app/frontend/public/logo-mark.png` | Used by `LogoMark` component in sidebar header |
| `app/frontend/public/favicon.png` | Old favicon |
| `Logo/logo.png` | **APPROVED NextAlloc logo** (12 027 bytes) |

### 2.7 Source References — `source-references/`

**REFERENCE SOURCE — DO NOT MODIFY.** These are read-only reference repositories not deployed as part of NextAlloc.

---

## 3. Legal / Attribution

| File | Content | Action |
|------|---------|--------|
| `app/LICENSE` | MIT, Copyright (c) 2026 The FinalCommit | **LEGAL ATTRIBUTION — PRESERVE** |
| `source-references/sih-bsod/LICENSE` | License for sih-bsod reference | **LEGAL ATTRIBUTION — PRESERVE** |

---

## 4. Deferred Internal Identifiers

The following identifiers are NOT being renamed in this rebrand because they are internal runtime contracts with no user-visible exposure and renaming carries significant breakage risk:

1. **Java package `in.pragati`** — 80+ source files. Renaming requires IDE refactoring + Maven rebuild. No user-visible impact.
2. **`@ConfigurationProperties(prefix = "pragati")`** + `application.yml` `pragati:` block — changing both simultaneously is safe but a separate coordinated change.
3. **Environment variables `PRAGATI_AI_URL`, `PRAGATI_STATIC_DIR`, `PRAGATI_UPLOADS_DIR`** — used in Docker Compose + `application.yml`. Renaming requires updating both files atomically; deferred to avoid breaking live deploys.
4. **`PragatiApplication.java` class name** — Spring Boot entry point; rename requires Maven coordination.
5. **H2 JDBC URL `jdbc:h2:mem:pragati`** — in-memory database name; not user-visible.
6. **JWT demo secret string** — contains "pragati" as prefix; this is a demo secret and not user-visible branding.
7. **ScenarioSeeder hash seed `"pragati|…"`** — changing breaks deterministic synthetic dataset; data integrity preserved.
8. **`localStorage` key `pragati_token`** — changing invalidates existing sessions; low priority for a demo rebrand.

---

## 5. Approved Changes (This Rebrand)

- ✅ `app/frontend/index.html` — page title + meta description
- ✅ `app/frontend/package.json` — name + description
- ✅ `app/frontend/src/components/Logo.tsx` — alt text, JSDoc, wordmark text
- ✅ `app/frontend/src/components/ErrorBoundary.tsx` — brand name strings
- ✅ `app/frontend/src/pages/Login.tsx` — heading, description, demo email domains
- ✅ `app/frontend/src/App.tsx` — loading spinner label
- ✅ `app/frontend/src/pages/admin/RunDetail.tsx` — report filename, section label
- ✅ `app/frontend/src/pages/admin/Scenarios.tsx` — seeder reference
- ✅ `app/frontend/src/pages/admin/WhatIf.tsx` — weights description
- ✅ `app/frontend/src/pages/candidate/Analytics.tsx` — weights source label
- ✅ `app/frontend/src/pages/candidate/Profile.tsx` — help text
- ✅ `app/ai-service/main.py` — FastAPI title + description + module docstring
- ✅ `app/ai-service/optimizer.py` — module docstring
- ✅ `app/backend/src/main/java/in/pragati/config/OpenApiConfig.java` — API title, description, contact
- ✅ `app/backend/src/main/java/in/pragati/common/Weights.java` — Javadoc comment
- ✅ `app/backend/src/main/java/in/pragati/seed/PolicySeeder.java` — comment + description string
- ✅ `app/backend/src/main/java/in/pragati/seed/ScenarioSeeder.java` — comment only (not the hash seed)
- ✅ `app/backend/pom.xml` — `<name>` and `<description>` only
- ✅ `app/docker-compose.yml` — comment header only
- ✅ `app/frontend/public/logo.png` — replaced with `Logo/logo.png`
- ✅ `app/docs/` — all documentation files

