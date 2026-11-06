# NEXTALLOC — VERSIONED SHARED SKILL CONTRACT SPECIFICATION
**Version:** `1.1.0-draft`
**Status:** DRAFT PROPOSAL FOR ARCHITECTURAL REVIEW (NOT CURRENTLY DEPLOYED IN PRODUCTION)
**Scope:** Cross-Service Representation (Python AI Service ⟷ Java Backend ⟷ OR-Tools CP-SAT)

---

## 1. Architectural Motivation & Problem Statement

In NextAlloc's current codebase:
1. **Conflation of Lexical Matching and Evidence Verification:**
   - In `CandidateSkill.java`, the boolean field `validated = true` indicates **only** that the label matched an entry in `SkillTaxonomy.CANONICAL` at the time of entry (lexical validation). It does **not** signify that an authorized university, employer, or assessor independently certified candidate competence.
   - An uploaded institutional NOC (`CandidateEvidence`) verifies **institutional permission** to participate in an internship; it does **not** certify technical proficiency in Python, Machine Learning, or any other specific skill.
2. **False Equivalence vs. Unfair Rejection:**
   - If an engineering tool (e.g. `PyTorch`) is coerced into a canonical skill (`Deep Learning`), it creates **false equivalence** for hard mandatory requirements.
   - If it is completely discarded, an applicant receives **zero credit** in preferred skill suitability.
3. **NLP Component Boundary:**
   - The NLP component can only establish whether two strings represent the same concept (`isLexicallyEquivalent`). It **must never** assert that a mandatory policy qualification is satisfied (`mandatoryRequirementSatisfied`). That decision is reserved strictly for Java's `EligibilityEvaluator.java`.
4. **Sectoral Blindspot:**
   - Legitimate occupational skills in manufacturing (`welding`, `cnc machining`), food processing (`baking`, `food safety`), agriculture (`crop agronomy`, `soil testing`), and healthcare clinical are missing from the prototype software-heavy 42-skill catalog.

---

## 2. Decoupled Contract Model

The versioned contract separates four independent dimensions:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. LEXICAL LEVEL (NLP Component)                                            │
│    - rawInput: "PyTorch"                                                    │
│    - canonicalName: "Deep Learning"                                         │
│    - relationType: RELATED_CONCEPT                                          │
│    - isLexicallyEquivalent: false  (True ONLY for EXACT or VERIFIED_ALIAS)  │
│    - proposedSoftWeight: 0.70      (Uncalibrated candidate weight)          │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ 2. PROVENANCE & EVIDENCE LEVEL (Candidate / Ingestion Service)              │
│    - claimSource: RESUME_EXTRACTION | SELF_DECLARED_PROFILE                 │
│    - evidenceStatus: UNVERIFIED_SELF_REPORTED | EXTRACTED_UNCONFIRMED       │
│      (Note: NOC verifies college permission, NOT technical competence)      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ 3. ONTOLOGY & SECTOR LEVEL (Shared Catalog)                                 │
│    - conceptId: "urn:nextalloc:skill:v1:deep-learning"                      │
│    - ontologyRelation: TOOL_OR_FRAMEWORK_FOR                                │
│    - taxonomyGap: false                                                     │
│    - sectorAttribution: null (or "Food Processing", "Manufacturing", etc.)  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ 4. POLICY ELIGIBILITY DECISION (Authoritative Java Evaluator ONLY)           │
│    - evaluated dynamically by EligibilityEvaluator.java                     │
│    - checks: isLexicallyEquivalent == true for mandatory requirements       │
│    - checks: academic verification, degree rank, NOC, participation state    │
│    - NLP NEVER declares mandatoryRequirementSatisfied = true                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Formal Schema Definitions

See the companion JSON schema: [`skill_contract_schema.json`](file:///C:/Users/shiva/Programming%20Projects/NextAlloc-PatchLab/app/ai-service/evaluation/contracts/skill_contract_schema.json).

### Field Definitions:

1. **`conceptId`** (`string`): Unique URN or ESCO URI identifying the canonical skill concept.
2. **`canonicalName`** (`string`): Authorized canonical display name in NextAlloc's catalog.
3. **`rawInput`** (`string`): Exact textual representation submitted by the candidate or extracted from a document.
4. **`relationType`** (`enum`):
   - `EXACT_CANONICAL`: Exact match against canonical catalog.
   - `VERIFIED_ALIAS`: Unambiguous direct abbreviation or exact synonym (e.g. `cpp` $\to$ `C++`, `ui/ux` $\to$ `UI/UX Design`).
   - `RELATED_CONCEPT`: Specialized tool, library, framework, or sub-discipline (e.g. `PyTorch`, `FastAPI`, `k8s`, `tally`, `front-end`).
   - `COMPOSITE_LABEL`: Multi-skill declaration requiring explicit decomposition (e.g. `C/C++`).
   - `OUT_OF_SCOPE_TAXONOMY`: Legitimate occupational skill outside prototype software catalog (e.g. `baking`, `welding`, `crop agronomy`).
   - `UNRELATED_TERM`: Non-occupational activity or casual pastime (`quantum flux`, `pasta cooking`).
5. **`isLexicallyEquivalent`** (`boolean`):
   - `true` **strictly** for `EXACT_CANONICAL` and `VERIFIED_ALIAS`.
   - `false` for related concepts, sub-disciplines, composites, out-of-scope skills, and non-skills.
   - **Crucial Rule:** `isLexicallyEquivalent = true` asserts only lexical equivalence. It does **not** assert that the applicant satisfies any mandatory policy requirement.
6. **`ontologyRelation`** (`enum`): `EQUIVALENT_TO`, `SPECIALIZATION_OF`, `GENERALIZATION_OF`, `TOOL_OR_FRAMEWORK_FOR`, `DISJOINT_FROM`.
7. **`claimSource`** (`enum`): `RESUME_EXTRACTION`, `SELF_DECLARED_PROFILE`, `ACADEMIC_TRANSCRIPT`, `INSTITUTIONAL_NOC`, `ADMIN_VERIFIED_ASSESSMENT`.
8. **`evidenceStatus`** (`enum`):
   - `UNVERIFIED_SELF_REPORTED`: Stated by candidate without corroborating evidence.
   - `EXTRACTED_UNCONFIRMED`: Detected by NLP in resume text, pending candidate confirmation.
   - `INSTITUTIONALLY_ATTESTED`: Corroborated by academic transcript or formal institutional assessment.
   - `ADMIN_AUDITED`: Explicitly audited and approved by program administrators.
9. **`proposedSoftWeight`** (`float` $[0.0, 1.0]$):
   - Uncalibrated candidate fractional weight for soft suitability research (e.g. 1.0 for exact/alias, 0.60–0.75 for verified tools, 0.0 for unrelated). Subject to empirical validation.
10. **`taxonomyGap`** (`boolean`): True if the query is a recognized occupational skill under national/ESCO taxonomies that lacks a canonical node in NextAlloc's prototype catalog.
11. **`sectorAttribution`** (`string | null`): Economic sector identity for out-of-scope trade skills.

---

## 4. Current Database Semantics & Migration Plan

- **Current Behavior in PostgreSQL:**
  - Table `candidate_skills` stores `raw_label`, `canonical`, `source` (`PROFILE` | `RESUME`), and `validated` (`boolean`).
  - `validated = true` indicates **solely** that `SkillTaxonomy.normalize(raw_label)` succeeded at profile submission time.
  - An uploaded institutional NOC does **not** attest to individual technical skills.
- **Future Additive Migration (Phase 4B-2B or later):**
  - Add nullable columns: `relation_type VARCHAR(32)`, `is_lexically_equivalent BOOLEAN`, `ontology_relation VARCHAR(32)`, `evidence_status VARCHAR(32)`, `soft_weight NUMERIC(3,2)`.
  - Backfill existing rows with `is_lexically_equivalent = true` and `evidence_status = 'UNVERIFIED_SELF_REPORTED'`.
  - Zero breaking changes to existing columns.
