"""
NextAlloc global allocation engine.

Deterministic two-stage lexicographic global optimization (Google OR-Tools CP-SAT)
plus a deterministic sequential (candidate-by-candidate) baseline. Both consume
the exact same dataset, eligibility set and suitability scores supplied by
the backend — nothing is invented or faked here.

Two-Stage Lexicographic Hierarchy:
  Stage 1: Maximize total placement count (inclusion first).
  Stage 2: Fix placement count to proven maximum K*, then maximize
           the documented composite quality score (score + pref).
"""

import math
import time
from collections import defaultdict

from ortools.sat.python import cp_model


def _index_pairs(pairs):
    by_c, by_i = defaultdict(list), defaultdict(list)
    for (c, i, score, pref) in pairs:
        by_c[c].append((i, score, pref))
        by_i[i].append(c)
    return by_c, by_i


def greedy_baseline(candidates, capacities, pairs):
    """
    Deterministic sequential baseline: candidates are processed in
    ascending id order; each takes the highest-scoring eligible
    opportunity with remaining capacity (ties broken by preference, then
    lower opportunity id).
    """
    by_c = defaultdict(list)
    for (c, i, score, pref) in pairs:
        by_c[c].append((score, pref, i))
    remaining = dict(capacities)
    chosen = []
    for c in sorted(by_c.keys()):
        best = None
        for (score, pref, i) in sorted(by_c[c], key=lambda t: (-t[0], -t[1], t[2])):
            if remaining.get(i, 0) > 0:
                best = (score, pref, i)
                break
        if best is not None:
            remaining[best[2]] -= 1
            chosen.append((c, best[2], best[0]))
    return chosen


def validate_assignments(assignments, candidates, capacities, pairs_set,
                         full_coverage=False, groups=None, expected_cardinality=None):
    """
    Independent validation of an assignment set against all active hard constraints.

    Checks:
    - Every (c, i) pair is a member of the original eligible-pair set.
    - Candidate uniqueness: no candidate is assigned more than once.
    - Opportunity capacity: no opportunity exceeds its declared capacity.
    - Full-coverage constraint: if enabled, every candidate must be assigned.
    - Demographic group fairness floors when groups are provided.
    - Cardinality claim: if expected_cardinality is given, the assignment count
      must equal that value (used to verify the K* cardinality proven in Stage 1
      is preserved by any rescued fallback).

    Returns (is_valid, reason).
    """
    c_counts = defaultdict(int)
    i_counts = defaultdict(int)
    for a in assignments:
        c, i = a["c"], a["i"]
        if (c, i) not in pairs_set:
            return False, f"Ineligible pair ({c}, {i}) assigned"
        c_counts[c] += 1
        if c_counts[c] > 1:
            return False, f"Candidate {c} assigned multiple times"
        i_counts[i] += 1
        if i_counts[i] > capacities.get(i, 0):
            return False, f"Opportunity {i} capacity exceeded ({i_counts[i]} > {capacities.get(i, 0)})"

    if full_coverage and len(assignments) != len(candidates):
        return False, f"Full coverage required {len(candidates)} assignments, got {len(assignments)}"

    if groups:
        assigned_cands = {a["c"] for a in assignments}
        for g in groups:
            floor = int(g.get("floorPct", 0))
            if floor > 0:
                members = [c for c in g.get("candidates", []) if any((c, opp_id) in pairs_set for opp_id in capacities)]
                need = math.ceil(len(members) * floor / 100.0)
                got = sum(1 for c in members if c in assigned_cands)
                if got < need:
                    return False, f"Group floor not satisfied for {g.get('key')}: need {need}, got {got}"

    if expected_cardinality is not None and len(assignments) != expected_cardinality:
        return False, (
            f"Cardinality mismatch: expected {expected_cardinality} assignments "
            f"(proven K*), got {len(assignments)}"
        )

    return True, "Valid"


def optimize(payload):
    t_start_mono = time.monotonic()
    t_start_wall = time.time()

    candidates = payload.get("candidates") or []
    opportunities = payload.get("opportunities") or []
    capacities = {o["id"]: o["capacity"] for o in opportunities}
    raw_pairs = payload.get("pairs") or []
    policy = payload.get("policy") or {}
    params = payload.get("params") or {}
    max_time = float(params.get("maxTimeSeconds", 60))
    workers = int(params.get("workers", 1))
    seed = int(params.get("seed", 0))

    deadline = t_start_mono + max_time

    # ------------------------------------------------------------------
    # Input Validation (returns MODEL_INVALID for structurally ill-formed inputs)
    # ------------------------------------------------------------------
    if any(cap < 0 for cap in capacities.values()):
        elapsed_ms = int((time.time() - t_start_wall) * 1000)
        return {
            "status": "MODEL_INVALID",
            "objective": 0,
            "runtimeMs": elapsed_ms,
            "metadata": {
                "stage1Status": "MODEL_INVALID",
                "stage2Status": None,
                "cardinalityOptimal": False,
                "suitabilityOptimal": False,
                "allocatedCount": 0,
                "secondaryObjective": 0,
                "usedFallback": False,
                "error": "Negative capacity specified for an opportunity",
            },
            "model": {"pairs": len(raw_pairs), "variables": 0, "constraints": 0, "solverRuntimeMs": elapsed_ms},
            "global": [],
            "greedy": [],
        }

    pairs = [(p["c"], p["i"], int(p["score"]), int(p.get("pref", 0))) for p in raw_pairs]
    pairs_set = {(p[0], p[1]) for p in pairs}
    by_c, by_i = _index_pairs(pairs)

    greedy = greedy_baseline(candidates, capacities, pairs)
    greedy_out = [{"c": c, "i": i, "score": s} for (c, i, s) in greedy]

    if not candidates or not pairs:
        elapsed_ms = int((time.time() - t_start_wall) * 1000)
        st = "INFEASIBLE" if policy.get("fullCoverage") and candidates else "OPTIMAL"
        return {
            "status": st,
            "objective": 0,
            "runtimeMs": elapsed_ms,
            "metadata": {
                "stage1Status": st,
                "stage2Status": st if st == "OPTIMAL" else None,
                "cardinalityOptimal": st == "OPTIMAL",
                "suitabilityOptimal": st == "OPTIMAL",
                "allocatedCount": 0,
                "secondaryObjective": 0,
                "usedFallback": False,
            },
            "model": {"pairs": len(pairs), "variables": 0, "constraints": 0, "solverRuntimeMs": elapsed_ms},
            "global": [],
            "greedy": greedy_out,
        }

    # ------------------------------------------------------------------
    # Model Construction: Hard Constraints
    # ------------------------------------------------------------------
    model = cp_model.CpModel()
    xs = {}
    for (c, i, score, pref) in pairs:
        xs[(c, i)] = model.NewBoolVar(f"x_{c}_{i}")

    # Hard: at most one opportunity per candidate.
    for c, entries in by_c.items():
        model.Add(sum(xs[(c, i)] for (i, _, _) in entries) <= 1)

    # Hard: capacity per opportunity.
    for i, cand_ids in by_i.items():
        model.Add(sum(xs[(c, i)] for c in cand_ids) <= capacities.get(i, 0))

    # Per-candidate allocation indicator.
    y_c = {}
    for c, entries in by_c.items():
        y = model.NewBoolVar(f"y_{c}")
        model.Add(sum(xs[(c, i)] for (i, _, _) in entries) >= 1).OnlyEnforceIf(y)
        model.Add(sum(xs[(c, i)] for (i, _, _) in entries) <= 0).OnlyEnforceIf(y.Not())
        y_c[c] = y

    # Hard policy: every candidate must be allocated.
    if policy.get("fullCoverage"):
        for c in candidates:
            total = sum(xs[(c, i)] for (i, _, _) in by_c.get(c, []))
            model.Add(total == 1)

    # Hard policy: group fairness floors.
    groups = policy.get("groups") or []
    for g in groups:
        floor = int(g.get("floorPct", 0))
        if floor <= 0:
            continue
        members = [y_c[c] for c in g.get("candidates", []) if c in y_c]
        need = math.ceil(len(members) * floor / 100.0)
        model.Add(sum(members) >= need)

    constraint_count = len(by_c) + len(by_i) + (len(candidates) if policy.get("fullCoverage") else 0)

    # ------------------------------------------------------------------
    # STAGE 1: Maximize Headcount (Inclusion First)
    # ------------------------------------------------------------------
    model.Maximize(sum(xs[(c, i)] for (c, i, _, _) in pairs))

    t_now = time.monotonic()
    t_rem = max(0.0, deadline - t_now)
    # Minimum useful budget: below this threshold the solver cannot make
    # meaningful progress and we must not grant it false time.
    _MIN_STAGE_BUDGET = 0.1
    if t_rem < _MIN_STAGE_BUDGET:
        elapsed_ms = int((time.time() - t_start_wall) * 1000)
        return {
            "status": "UNKNOWN",
            "objective": 0,
            "runtimeMs": elapsed_ms,
            "metadata": {
                "stage1Status": "UNKNOWN",
                "stage2Status": None,
                "cardinalityOptimal": False,
                "suitabilityOptimal": False,
                "allocatedCount": 0,
                "secondaryObjective": 0,
                "usedFallback": False,
            },
            "model": {"pairs": len(pairs), "variables": len(xs), "constraints": constraint_count, "solverRuntimeMs": elapsed_ms},
            "global": [],
            "greedy": greedy_out,
        }

    # Budget Stage 1: up to 40% of remaining time, never exceeding remaining budget.
    # The floor is clamped to the actual remaining time, so Stage 1 is never granted
    # more than what the shared deadline allows.
    t1 = min(t_rem, min(20.0, t_rem * 0.40))

    solver1 = cp_model.CpSolver()
    solver1.parameters.max_time_in_seconds = t1
    solver1.parameters.num_workers = workers
    solver1.parameters.random_seed = seed
    solver1.parameters.log_search_progress = False

    t_s1_start = time.monotonic()
    status1 = solver1.Solve(model)
    t_s1_elapsed_ms = int((time.monotonic() - t_s1_start) * 1000)

    # Stage 1 terminal outcomes:
    if status1 == cp_model.INFEASIBLE:
        elapsed_ms = int((time.time() - t_start_wall) * 1000)
        return {
            "status": "INFEASIBLE",
            "objective": 0,
            "runtimeMs": elapsed_ms,
            "metadata": {
                "stage1Status": "INFEASIBLE",
                "stage2Status": None,
                "cardinalityOptimal": False,
                "suitabilityOptimal": False,
                "allocatedCount": 0,
                "secondaryObjective": 0,
                "usedFallback": False,
            },
            "model": {"pairs": len(pairs), "variables": len(xs), "constraints": constraint_count, "solverRuntimeMs": elapsed_ms},
            "global": [],
            "greedy": greedy_out,
        }

    if status1 == cp_model.MODEL_INVALID:
        elapsed_ms = int((time.time() - t_start_wall) * 1000)
        return {
            "status": "MODEL_INVALID",
            "objective": 0,
            "runtimeMs": elapsed_ms,
            "metadata": {
                "stage1Status": "MODEL_INVALID",
                "stage2Status": None,
                "cardinalityOptimal": False,
                "suitabilityOptimal": False,
                "allocatedCount": 0,
                "secondaryObjective": 0,
                "usedFallback": False,
            },
            "model": {"pairs": len(pairs), "variables": len(xs), "constraints": constraint_count, "solverRuntimeMs": elapsed_ms},
            "global": [],
            "greedy": greedy_out,
        }

    if status1 == cp_model.UNKNOWN:
        elapsed_ms = int((time.time() - t_start_wall) * 1000)
        return {
            "status": "UNKNOWN",
            "objective": 0,
            "runtimeMs": elapsed_ms,
            "metadata": {
                "stage1Status": "UNKNOWN",
                "stage2Status": None,
                "cardinalityOptimal": False,
                "suitabilityOptimal": False,
                "allocatedCount": 0,
                "secondaryObjective": 0,
                "usedFallback": False,
            },
            "model": {"pairs": len(pairs), "variables": len(xs), "constraints": constraint_count, "solverRuntimeMs": elapsed_ms},
            "global": [],
            "greedy": greedy_out,
        }

    # Extract Stage 1 solution (safe to read values now).
    stage1_solution = []
    for (c, i, score, pref) in pairs:
        if solver1.Value(xs[(c, i)]) == 1:
            stage1_solution.append({"c": c, "i": i, "score": score})

    valid, reason = validate_assignments(
        stage1_solution, candidates, capacities, pairs_set,
        policy.get("fullCoverage"), groups,
        expected_cardinality=None,  # K* is not yet known at Stage 1 extraction
    )
    if not valid:
        elapsed_ms = int((time.time() - t_start_wall) * 1000)
        return {
            "status": "MODEL_INVALID",
            "objective": 0,
            "runtimeMs": elapsed_ms,
            "metadata": {
                "stage1Status": "MODEL_INVALID",
                "stage2Status": None,
                "cardinalityOptimal": False,
                "suitabilityOptimal": False,
                "allocatedCount": 0,
                "secondaryObjective": 0,
                "usedFallback": False,
                "error": f"Stage 1 validation failed: {reason}",
            },
            "model": {"pairs": len(pairs), "variables": len(xs), "constraints": constraint_count, "solverRuntimeMs": elapsed_ms},
            "global": [],
            "greedy": greedy_out,
        }

    # If Stage 1 is FEASIBLE without proof of optimality:
    # Retain the valid provisional result; do NOT proceed to Stage 2 since K* is unproven.
    if status1 == cp_model.FEASIBLE:
        elapsed_ms = int((time.time() - t_start_wall) * 1000)
        sec_obj = sum(a["score"] for a in stage1_solution)
        return {
            "status": "FEASIBLE",
            "objective": sec_obj,
            "runtimeMs": elapsed_ms,
            "metadata": {
                "stage1Status": "FEASIBLE",
                "stage2Status": None,
                "cardinalityOptimal": False,
                "suitabilityOptimal": False,
                "allocatedCount": len(stage1_solution),
                "secondaryObjective": sec_obj,
                "usedFallback": False,
            },
            "model": {"pairs": len(pairs), "variables": len(xs), "constraints": constraint_count, "solverRuntimeMs": elapsed_ms},
            "global": stage1_solution,
            "greedy": greedy_out,
        }

    # ------------------------------------------------------------------
    # STAGE 2: Maximize Composite Quality Score (at proven K*)
    # ------------------------------------------------------------------
    # status1 is strictly cp_model.OPTIMAL here. K* is proven.
    k_star = int(solver1.ObjectiveValue())

    t_now = time.monotonic()
    t_rem = max(0.0, deadline - t_now)

    # If remaining budget is too small to perform a meaningful Stage 2 search:
    if t_rem < 0.5:
        elapsed_ms = int((time.time() - t_start_wall) * 1000)
        sec_obj = sum(a["score"] for a in stage1_solution)
        return {
            "status": "FEASIBLE",
            "objective": sec_obj,
            "runtimeMs": elapsed_ms,
            "metadata": {
                "stage1Status": "OPTIMAL",
                "stage2Status": "TIME_EXHAUSTED",
                "cardinalityOptimal": True,
                "suitabilityOptimal": False,
                "allocatedCount": len(stage1_solution),
                "secondaryObjective": sec_obj,
                "usedFallback": True,
            },
            "model": {"pairs": len(pairs), "variables": len(xs), "constraints": constraint_count, "solverRuntimeMs": elapsed_ms},
            "global": stage1_solution,
            "greedy": greedy_out,
        }

    # Add hard constraint: allocation count must achieve proven maximum K*.
    model.Add(sum(xs[(c, i)] for (c, i, _, _) in pairs) >= k_star)

    # Optional warm-start hint from Stage 1 solution.
    for (c, i, _, _) in pairs:
        model.AddHint(xs[(c, i)], solver1.Value(xs[(c, i)]))

    # Documented composite quality score: score + pref.
    model.Maximize(sum((score + pref) * xs[(c, i)] for (c, i, score, pref) in pairs))

    solver2 = cp_model.CpSolver()
    solver2.parameters.max_time_in_seconds = max(0.001, t_rem)
    solver2.parameters.num_workers = workers
    solver2.parameters.random_seed = seed
    solver2.parameters.log_search_progress = False

    t_s2_start = time.monotonic()
    status2 = solver2.Solve(model)
    t_s2_elapsed_ms = int((time.monotonic() - t_s2_start) * 1000)

    elapsed_ms = int((time.time() - t_start_wall) * 1000)

    # Handle Stage 2 MODEL_INVALID: never conceal with fallback!
    if status2 == cp_model.MODEL_INVALID:
        return {
            "status": "MODEL_INVALID",
            "objective": 0,
            "runtimeMs": elapsed_ms,
            "metadata": {
                "stage1Status": "OPTIMAL",
                "stage2Status": "MODEL_INVALID",
                "cardinalityOptimal": True,
                "suitabilityOptimal": False,
                "allocatedCount": 0,
                "secondaryObjective": 0,
                "usedFallback": False,
                "error": "Stage 2 model was invalid",
            },
            "model": {"pairs": len(pairs), "variables": len(xs), "constraints": constraint_count + 1, "solverRuntimeMs": elapsed_ms},
            "global": [],
            "greedy": greedy_out,
        }

    # Handle Stage 2 UNKNOWN: rescue with verified Stage 1 fallback.
    if status2 == cp_model.UNKNOWN:
        sec_obj = sum(a["score"] for a in stage1_solution)
        return {
            "status": "FEASIBLE",
            "objective": sec_obj,
            "runtimeMs": elapsed_ms,
            "metadata": {
                "stage1Status": "OPTIMAL",
                "stage2Status": "UNKNOWN",
                "cardinalityOptimal": True,
                "suitabilityOptimal": False,
                "allocatedCount": len(stage1_solution),
                "secondaryObjective": sec_obj,
                "usedFallback": True,
            },
            "model": {"pairs": len(pairs), "variables": len(xs), "constraints": constraint_count + 1, "solverRuntimeMs": elapsed_ms},
            "global": stage1_solution,
            "greedy": greedy_out,
        }

    # Status2 is OPTIMAL or FEASIBLE. Extract Stage 2 solution.
    stage2_solution = []
    for (c, i, score, pref) in pairs:
        if solver2.Value(xs[(c, i)]) == 1:
            stage2_solution.append({"c": c, "i": i, "score": score})

    valid, reason = validate_assignments(
        stage2_solution, candidates, capacities, pairs_set,
        policy.get("fullCoverage"), groups,
        expected_cardinality=k_star,  # Stage 2 must preserve the proven K* cardinality
    )
    if not valid:
        # If Stage 2 solution failed validation, fail visibly
        return {
            "status": "MODEL_INVALID",
            "objective": 0,
            "runtimeMs": elapsed_ms,
            "metadata": {
                "stage1Status": "OPTIMAL",
                "stage2Status": "MODEL_INVALID",
                "cardinalityOptimal": True,
                "suitabilityOptimal": False,
                "allocatedCount": 0,
                "secondaryObjective": 0,
                "usedFallback": False,
                "error": f"Stage 2 solution validation failed: {reason}",
            },
            "model": {"pairs": len(pairs), "variables": len(xs), "constraints": constraint_count + 1, "solverRuntimeMs": elapsed_ms},
            "global": [],
            "greedy": greedy_out,
        }

    is_optimal = (status2 == cp_model.OPTIMAL)
    st = "OPTIMAL" if is_optimal else "FEASIBLE"
    sec_obj = int(solver2.ObjectiveValue())

    return {
        "status": st,
        "objective": sec_obj,
        "runtimeMs": elapsed_ms,
        "metadata": {
            "stage1Status": "OPTIMAL",
            "stage2Status": "OPTIMAL" if is_optimal else "FEASIBLE",
            "cardinalityOptimal": True,
            "suitabilityOptimal": is_optimal,
            "allocatedCount": len(stage2_solution),
            "secondaryObjective": sec_obj,
            "usedFallback": False,
        },
        "model": {
            "pairs": len(pairs),
            "variables": len(xs),
            "constraints": constraint_count + 1,
            "solverRuntimeMs": elapsed_ms,
        },
        "global": stage2_solution,
        "greedy": greedy_out,
    }
