# NEXTALLOC — PHASE 4B-1A: RESEARCH-GRADE BASELINE REPORT
**Date:** November 2026
**Git Baseline Commit:** `bcd5667` (`feat(frontend): integrate academic and NOC verification workflows`)
**Target Subsystem:** AI Service (`app/ai-service/nlp.py`, `app/ai-service/main.py`) & Allocation Scoring Pipeline

---

## 1. Executive Summary & Objective

In accordance with the Lead Architect Directive for **Phase 4B-1A**, all production scoring logic, Java backend services, React components, and Docker configurations remained strictly **read-only and unmodified**.

The mission of Phase 4B-1A was to establish a **reproducible, frozen research baseline** for evaluating the current skill matching, normalization, and extraction capabilities of NextAlloc prior to implementing any semantic scoring enhancements (Phase 4B-1B).

This report records the exact empirical baseline metrics, dataset provenance, scoring authority analysis, and operational limitations under a frozen benchmark protocol.

---

## 2. Production Scoring Pipeline & Authority Architecture

### 2.1 The End-to-End Runtime Path
Inspection of the Java and Python codebases established the exact operational path:

```
Candidate Profile & Resume Ingestion
  │
  ├── [Manual Profile / Skills Entry] ──────────► Java SkillTaxonomy.normalize()
  └── [PDF Resume Upload (/nlp/skills)] ───────► Python nlp.extract_skills()
                                                        │
                                                        ▼
                                              PostgreSQL CandidateSkill (canonical, validated=true)
                                                        │
                                                        ▼
                                              AllocationService.execute()
                                                        │
                                                        ▼
                                              EligibilityEvaluator & SuitabilityService.check()
                                              (Hard eligibility gate: mandatory skills, degree, state)
                                                        │
                                                        ▼
                                              SuitabilityService.score()
                                              (Authoritative weighted composite: 0 - 100)
                                                        │
                                                        ▼
                                              AiServiceClient.optimize()
                                              (Sends integer scores: Math.round(overall * 100))
                                                        │
                                                        ▼
                                              Python OR-Tools CP-SAT Solver (/optimize)
                                              (Global constrained assignment optimization)
```

### 2.2 Authoritative Scoring Findings
1. **Primary Scoring Authority:** **Java `SuitabilityService.java`** computes authoritative suitability scores. Python AI Service is an optimization engine (`/optimize`) and extraction utility (`/nlp/skills`), not the allocation suitability scoring engine.
2. **Current Python NLP Runtime Effect on Allocation:** Python NLP runs **only** during resume upload extraction (`CandidateService.extractSkills`). During actual batch allocation runs (`AllocationService.java`), Python NLP is **not invoked**; rather, candidate skills already persisted in PostgreSQL are evaluated.
3. **Semantic Embeddings Status:** **None exist** in production. `nlp.py` uses rigid regex matching against 42 canonical terms (`CANONICAL`) and 73 synonyms (`SYNONYMS`). `main.py` reports `aiMode: "deterministic-taxonomy"` and `embeddingModel: null`.
4. **CP-SAT Input:** Python's CP-SAT solver receives pairs with pre-computed integer weights: `(int) Math.round(p.score().overall() * 100)`.
5. **Architectural Implication:** Improving Python NLP in `nlp.py` enhances resume extraction recall and API skill normalization. To propagate continuous semantic matching into the live allocation solver objective, Java's `SuitabilityService.java` (`skillsFit`) must also be integrated or coordinated with the semantic scoring model.

---

## 3. Frozen Benchmark Dataset Specifications

The benchmark is located at `app/ai-service/evaluation/datasets/semantic_skill_benchmark.json`.

### 3.1 Normalization Benchmark Composition (60 Queries)
The benchmark evaluates 1-to-1 skill query projection onto the 42-member canonical taxonomy across 4 distinct splits:

| Category Split | Count | Expected Output | Description & Intent |
| :--- | :---: | :--- | :--- |
| `in_vocabulary_sanity` | 20 | Canonical skill string | Validates 100% regression fidelity for exact canonicals and registered synonyms (e.g. `Python`, `spring boot` $\to$ `Java`). |
| `out_of_vocabulary_semantic` | 20 | Canonical skill string | Real industry tools missing from synonyms that semantically belong to a canonical bucket (e.g. `PyTorch` $\to$ `Deep Learning`, `FastAPI` $\to$ `Python`). |
| `negative_controls` | 10 | `None` (rejection) | Non-internship terms (`baking`, `gardening`, `cricket`) to test specificity and prevent false positive hallucinations. |
| `held_out_test` | 10 | Canonical skill string | Completely independent unseen skill variants (`Scikit-Learn`, `Flutter`, `Ansible`, `HuggingFace Transformers`) reserved for unbiased generalization testing. |

### 3.2 Resume Extraction Benchmark Composition (5 Cases)
Evaluates token-level precision, recall, and F1 over realistic multi-sentence candidate resume summaries:
- **RES-01 to RES-04:** Realistic resumes containing mixtures of in-vocabulary and out-of-vocabulary skills across Data Science, Frontend, Cloud/DevOps, and Backend.
- **RES-05:** Pure negative control resume containing hobby activities (`sourdough bread`, `hiking`, `piano`) where expected skills set is $\emptyset$.

---

## 4. Empirical Baseline Results (Measured)

Executed via `python app/ai-service/evaluation/benchmark_runner.py` on AMD64 under Python 3.11.9:

### 4.1 Skill Normalization Performance
- **Total Queries Evaluated:** 60
- **Overall Normalization Accuracy:** **53.3%** (32 / 60 correct)
- **Negative Control Rejection Specificity:** **100.0%** (10 / 10 non-skills correctly rejected as `None`)

#### Category Breakdown:
| Category | Evaluated | Correct | Accuracy | Observed Errors |
| :--- | :---: | :---: | :---: | :--- |
| `in_vocabulary_sanity` | 20 | 20 | **100.0%** | None |
| `out_of_vocabulary_semantic` | 20 | 2 | **10.0%** | 18 errors (`PyTorch`, `FastAPI`, `TypeScript`, `Pandas`, `Kubernetes`, etc. returned `None`) |
| `negative_controls` | 10 | 10 | **100.0%** | None (100% rejection rate) |
| `held_out_test` | 10 | 0 | **0.0%** | 10 errors (All 10 unseen industry skills returned `None`) |

*Note on accidental OOV matches:* The 2 "correct" OOV items (`PostgreSQL` $\to$ `SQL` and `REST API development` $\to$ `Web Development`) succeeded only because `postgresql` was already hardcoded in `SYNONYMS` and `REST API development` happened to match the substring regex `web dev`.

### 4.2 Resume Skill Extraction Performance
- **Samples Evaluated:** 5 multi-sentence paragraphs
- **Macro Precision:** **100.0%** (0 false positives generated)
- **Macro Recall:** **86.0%**
- **Macro F1 Score:** **92.1%**
- **Micro Precision:** **100.0%**
- **Micro Recall:** **80.0%**
- **Micro F1 Score:** **88.9%**

*Deficit Analysis:* Out of 20 total ground-truth skill occurrences across resumes, 4 modern skills (`Deep Learning` from PyTorch, `Web Development` from Next.js, `Statistics` from statistical testing) were completely omitted because the regex pipeline cannot recognize semantic equivalence.

### 4.3 Computational Performance & Latency
- **Normalization Execution Time:** 0.23 ms for 60 queries (~0.0038 ms / query; ~260,000 queries/sec).
- **Resume Extraction Execution Time:** 1.14 ms for 5 resumes (~0.228 ms / resume; ~4,385 resumes/sec).
- **Memory Footprint:** Negligible (in-memory static dictionary lookups, zero model weights).
- **Deterministic Repeatability:** 100% bit-for-bit identical across runs.

---

## 5. Information Retrieval & Metric Applicability Clarification

Per Gate A evaluation criteria:
- **Number of Candidate Profiles:** NOT APPLICABLE (This benchmark evaluates skill query normalization and resume text extraction; candidate profiles are not aggregated into ranked retrieval lists).
- **Number of Internship Opportunities:** NOT APPLICABLE.
- **Candidate-Opportunity Pairs:** NOT APPLICABLE.
- **Precision@K, Recall@K, nDCG@K, MRR:** **NOT APPLICABLE** for this normalization benchmark.
  *Explanation:* Top-K ranking metrics require a ranked list of retrieved items evaluated against graded or binary relevance labels per query. The current deterministic taxonomy normalization is a 1-to-1 scalar mapping function: $\text{normalize}(q) \to c \in \mathcal{C} \cup \{\text{None}\}$. It does not output a ranked list or probability distribution over candidates. Evaluating nDCG@K on a scalar classification output is mathematically undefined.

---

## 6. Relevance Label Quality & Limitations

1. **Synthetic vs. Independent Human-Reviewed:** The benchmark labels were human-curated by the NextAlloc engineering team based on standard industry software taxonomies (e.g. mapping `PyTorch` to `Deep Learning`, `TypeScript` to `JavaScript`). They have **not** been independently verified by a multi-annotator external panel.
2. **Temporal Order:** Benchmark labels were fully defined in `semantic_skill_benchmark.json` **prior** to executing the runner.
3. **Label Independence:** Ground truth labels do not depend on the scorer's output (proven by the 46.7% error rate).
4. **Generalization Scope:** A 60-sample benchmark is sufficient to prove the complete failure of regex matching on out-of-vocabulary skills ($10\%$ accuracy), but cannot be extrapolated as an exhaustive empirical assessment of nationwide multi-sector internship applicants.

---

## 7. Recommended Phase 4B-1B Enhancement Architecture

To address the measured 90% OOV failure rate while preserving 100% negative control specificity:

1. **Two-Stage Hybrid Cascade:**
   - **Stage 1 (Exact Match):** Retain canonical and synonym regex matching ($O(1)$, instant, deterministic).
   - **Stage 2 (Semantic Embedding Fallback):** For unmapped terms, compute cosine similarity between the query embedding and pre-computed normalized embeddings of the 42 canonical skills.
2. **Thresholded Decision Boundary:**
   - Apply a strict cosine similarity cutoff ($\tau \approx 0.72$). If $\max \text{sim} < \tau$, return `None`. This preserves 100% specificity on non-skills like *baking* or *gardening*.
3. **Model Selection:**
   - A lightweight Sentence-Transformer (e.g. `all-MiniLM-L6-v2`, ~80MB) running on CPU, requiring ~15ms inference latency, or an equivalent local ONNX runtime model.
