# Third-Party Notices — NextAlloc (SIH25033)

This document lists the third-party open-source software incorporated into the NextAlloc application.

---

## Frontend Dependencies (`app/frontend/`)

| Package | License | Notes |
|---------|---------|-------|
| React 18 | MIT | Facebook, Inc. and contributors |
| react-dom | MIT | Facebook, Inc. and contributors |
| react-router-dom 6 | MIT | Remix Software, Inc. |
| axios | MIT | Matt Zabriskie and contributors |
| recharts | MIT | recharts group |
| leaflet | BSD-2-Clause | Vladimir Agafonkin and contributors |
| lucide-react | ISC | Lucide Contributors |
| @fontsource-variable/inter | OFL-1.1 | Rasmus Andersson |
| @fontsource-variable/sora | OFL-1.1 | Omnibus-Type |
| Vite | MIT | Yuxi (Evan) You and contributors |
| TypeScript | Apache-2.0 | Microsoft Corporation |
| Tailwind CSS | MIT | Tailwind Labs, Inc. |
| PostCSS | MIT | Andrey Sitnik |
| autoprefixer | MIT | Andrey Sitnik |

## Backend Dependencies (`app/backend/`)

| Package | License | Notes |
|---------|---------|-------|
| Spring Boot 3.4.1 | Apache-2.0 | VMware, Inc. / Broadcom |
| Spring Security | Apache-2.0 | VMware, Inc. / Broadcom |
| Spring Data JPA | Apache-2.0 | VMware, Inc. / Broadcom |
| springdoc-openapi 2.6.0 | Apache-2.0 | springdoc.org |
| JJWT 0.12.6 | Apache-2.0 | Stormpath, Inc. / auth0 |
| OpenPDF 1.3.30 | LGPL-2.1 / MPL-2.0 | Werner Ramaekers et al. |
| Apache PDFBox 3.0.3 | Apache-2.0 | Apache Software Foundation |
| Apache POI 5.2.5 | Apache-2.0 | Apache Software Foundation |
| H2 Database | EPL-1.0 / MPL-2.0 | H2 Group |
| MySQL Connector/J | GPL-2.0 with FOSS exception | Oracle Corporation |
| Hibernate ORM | LGPL-2.1 | Red Hat, Inc. |
| Jackson | Apache-2.0 | FasterXML, LLC |

## AI Service Dependencies (`app/ai-service/`)

| Package | License | Notes |
|---------|---------|-------|
| FastAPI | MIT | Sebastián Ramírez |
| Pydantic | MIT | Samuel Colvin and contributors |
| OR-Tools (Google) | Apache-2.0 | Google LLC |
| uvicorn | BSD-3-Clause | Tom Christie and contributors |

---

## Source Reference Repositories (NOT deployed)

The following repositories are included under `source-references/` as read-only technical references. Their code is NOT incorporated into the NextAlloc application build.

### `source-references/sih-bsod/`
- **Purpose:** UI/workflow reference
- **License:** See `source-references/sih-bsod/LICENSE`
- **Status:** Reference only — not built, not deployed

### `source-references/suyash-ml/`
- **Purpose:** ML matching reference
- **License:** See `source-references/suyash-ml/nestbackend/ml-service/` (if present)
- **Status:** Reference only — not built, not deployed

---

## Copyright and Attribution

The NextAlloc application (originally developed as PRAGATI for Smart India Hackathon 2026, problem statement SIH25033) is covered by the MIT License in `app/LICENSE`.

Copyright (c) 2026 The FinalCommit

This product was developed for the PM Internship Scheme allocation problem (SIH25033) and is a demonstration build. All data is synthetic and system-generated.

---

*This file was generated as part of the NextAlloc rebrand (feature/nextalloc-rebrand).*
*Maintainers: review annually and update when dependencies change.*

