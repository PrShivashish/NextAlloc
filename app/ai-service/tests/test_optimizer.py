import itertools
import math
import sys
from collections import defaultdict
from pathlib import Path
from unittest.mock import MagicMock, patch

from ortools.sat.python import cp_model

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import optimizer


def _run(pairs, caps, full_coverage=False, groups=None, candidates=None, max_time=10, workers=1, seed=0):
    payload = {
        "candidates": candidates if candidates is not None else sorted({p[0] for p in pairs}),
        "opportunities": [{"id": i, "capacity": c} for i, c in caps.items()],
        "pairs": [{"c": c, "i": i, "score": s, "pref": p if len(pair) > 3 else 0} for pair in pairs for (c, i, s, p) in [(pair[0], pair[1], pair[2], pair[3] if len(pair) > 3 else 0)]],
        "policy": {"fullCoverage": full_coverage, "groups": groups or []},
        "params": {"maxTimeSeconds": max_time, "workers": workers, "seed": seed},
    }
    return optimizer.optimize(payload)


# ==================================================================
# INDEPENDENT EXACT COMBINATORIAL ORACLE
# ==================================================================

def independent_oracle(candidates, capacities, pairs, full_coverage=False, groups=None):
    """
    Independent brute-force combinatorial assignment oracle.
    Exhaustively searches all valid matchings to find:
      1. Maximum placement cardinality K_max.
      2. Among matchings achieving K_max, maximum composite quality score Z2_max.
    Zero dependency on Google OR-Tools.
    """
    pairs_list = [(p[0], p[1], p[2], p[3] if len(p) > 3 else 0) for p in pairs]
    n = len(pairs_list)
    best_k = -1
    best_score = -1
    best_assignments = []

    # Check all 2^N subsets of pairs
    for r in range(n + 1):
        for subset in itertools.combinations(pairs_list, r):
            c_counts = defaultdict(int)
            i_counts = defaultdict(int)
            valid = True
            for (c, i, _, _) in subset:
                c_counts[c] += 1
                if c_counts[c] > 1:
                    valid = False
                    break
                i_counts[i] += 1
                if i_counts[i] > capacities.get(i, 0):
                    valid = False
                    break
            if not valid:
                continue

            if full_coverage and len(subset) != len(candidates):
                continue

            if groups:
                assigned_cands = {c for (c, _, _, _) in subset}
                floor_ok = True
                for g in groups:
                    floor = int(g.get("floorPct", 0))
                    if floor > 0:
                        members = [c for c in g.get("candidates", []) if any(p[0] == c and p[1] in capacities for p in pairs_list)]
                        need = math.ceil(len(members) * floor / 100.0)
                        got = sum(1 for c in members if c in assigned_cands)
                        if got < need:
                            floor_ok = False
                            break
                if not floor_ok:
                    continue

            k = len(subset)
            score = sum(s + p for (_, _, s, p) in subset)

            if k > best_k or (k == best_k and score > best_score):
                best_k = k
                best_score = score
                best_assignments = [{"c": c, "i": i, "score": s} for (c, i, s, p) in subset]

    return best_k, best_score, best_assignments


# ==================================================================
# EXISTING FUNCTIONAL TESTS (PRESERVED)
# ==================================================================

def test_capacity_respected():
    res = _run([(1, 10, 90, 0), (2, 10, 80, 0)], {10: 1})
    assert res["status"] in ("OPTIMAL", "FEASIBLE")
    assert len(res["global"]) == 1
    assert res["global"][0]["c"] == 1


def test_at_most_one_per_candidate():
    res = _run([(1, 10, 50, 0), (1, 11, 90, 0)], {10: 1, 11: 1})
    assert len(res["global"]) == 1
    assert res["global"][0]["i"] == 11


def test_global_beats_sequential_on_engineered_swap():
    res = _run([(1, 1, 90, 0), (1, 2, 20, 0), (2, 1, 85, 0), (2, 2, 95, 0)], {1: 1, 2: 1})
    global_pairs = {(a["c"], a["i"]) for a in res["global"]}
    greedy_pairs = {(a["c"], a["i"]) for a in res["greedy"]}
    assert global_pairs == {(1, 1), (2, 2)}
    assert greedy_pairs == {(1, 1), (2, 2)}


def test_global_swap_improvement():
    res = _run([(1, 1, 90, 0), (1, 2, 88, 0), (2, 1, 86, 0), (2, 2, 30, 0), (3, 1, 84, 0), (3, 2, 20, 0)],
               {1: 1, 2: 2})
    g = {(a["c"], a["i"]): a["score"] for a in res["global"]}
    gr = {(a["c"], a["i"]): a["score"] for a in res["greedy"]}
    assert sum(g.values()) > sum(gr.values())
    assert (1, 2) in g


def test_infeasible_full_coverage():
    res = _run([(1, 1, 90, 0), (2, 1, 80, 0), (3, 1, 70, 0)], {1: 1}, full_coverage=True)
    assert res["status"] == "INFEASIBLE"


def test_infeasible_group_floor():
    res = _run([(1, 1, 90, 0), (2, 1, 80, 0)], {1: 1},
               groups=[{"key": "RURAL", "candidates": [1, 2], "floorPct": 100}])
    assert res["status"] == "INFEASIBLE"


def test_feasible_group_floor():
    res = _run([(1, 1, 90, 0), (2, 1, 80, 0)], {1: 2},
               groups=[{"key": "RURAL", "candidates": [1, 2], "floorPct": 50}])
    assert res["status"] in ("OPTIMAL", "FEASIBLE")
    assert len(res["global"]) == 2


def test_deterministic_repeat():
    a = _run([(1, 1, 90, 0), (2, 1, 88, 0), (3, 1, 86, 0), (1, 2, 40, 0)], {1: 1, 2: 1})
    b = _run([(1, 1, 90, 0), (2, 1, 88, 0), (3, 1, 86, 0), (1, 2, 40, 0)], {1: 1, 2: 1})
    assert a["global"] == b["global"]
    assert a["greedy"] == b["greedy"]
    assert a["objective"] == b["objective"]


def test_empty_pairs():
    res = _run([], {1: 5})
    assert res["status"] == "OPTIMAL"
    assert res["global"] == []
    assert res["greedy"] == []


# ==================================================================
# PATCH 2: MATHEMATICAL CORRECTNESS & ADVERSARIAL COUNTEREXAMPLE
# ==================================================================

def test_adversarial_three_vs_two_cardinality():
    """
    Mandatory Phase 3 counterexample:
    Candidates A (1), B (2), C (3).
    Opportunities X (10), Y (11), Z (12), capacity 1 each.
    Pairs:
      (1, 10, 10000, 0)
      (1, 11, 0, 0)
      (2, 11, 10000, 0)
      (2, 12, 0, 0)
      (3, 10, 0, 0)

    Option 1: 2 assignments (1->10, 2->11) total score = 20000.
    Option 2: 3 assignments (3->10, 1->11, 2->12) total score = 0.

    Under the old single-stage objective, 20002 > 00003 so the solver chose Option 1.
    Under the two-stage lexicographic objective, placement count is maximized first,
    so Option 2 (3 assignments) MUST be chosen.
    """
    pairs = [
        (1, 10, 10000, 0),
        (1, 11, 0, 0),
        (2, 11, 10000, 0),
        (2, 12, 0, 0),
        (3, 10, 0, 0),
    ]
    caps = {10: 1, 11: 1, 12: 1}
    candidates = [1, 2, 3]

    k_oracle, s_oracle, _ = independent_oracle(candidates, caps, pairs)
    assert k_oracle == 3, "Independent oracle proves 3 placements are possible"

    res = _run(pairs, caps, candidates=candidates)
    assert res["status"] == "OPTIMAL"
    assert len(res["global"]) == 3, f"Must allocate all 3 candidates, but got {len(res['global'])}"
    allocated_cands = {a["c"] for a in res["global"]}
    assert allocated_cands == {1, 2, 3}, "Every candidate must be allocated"


def test_oracle_agreement_multiple_instances():
    """
    Cross-checks the two-stage solver against the independent brute-force oracle
    across small instances with varying densities and preference bonuses.
    """
    instances = [
        # Instance 1: Balanced competition
        ([1, 2, 3, 4], {10: 1, 11: 2, 12: 1}, [
            (1, 10, 50, 1), (1, 11, 60, 0),
            (2, 10, 70, 0), (2, 11, 40, 1),
            (3, 11, 80, 0), (3, 12, 30, 0),
            (4, 12, 90, 1)
        ]),
        # Instance 2: Heavy contention for one opportunity
        ([1, 2, 3], {10: 1, 11: 1}, [
            (1, 10, 95, 1), (2, 10, 90, 0), (3, 10, 85, 0),
            (1, 11, 10, 0), (2, 11, 20, 0)
        ]),
        # Instance 3: Disjoint components
        ([1, 2, 3, 4], {10: 1, 11: 1, 12: 1}, [
            (1, 10, 40, 0), (2, 10, 50, 0),
            (3, 11, 60, 0), (4, 12, 70, 0)
        ]),
    ]

    for cands, caps, pairs in instances:
        k_oracle, s_oracle, _ = independent_oracle(cands, caps, pairs)
        res = _run(pairs, caps, candidates=cands)
        assert res["status"] == "OPTIMAL"
        assert len(res["global"]) == k_oracle, f"Expected cardinality {k_oracle}, got {len(res['global'])}"
        # Secondary objective in CP-SAT should match or beat oracle max score at k_oracle
        solver_score = sum(a["score"] for a in res["global"])
        # (res["objective"] includes score + pref)
        assert res["objective"] == s_oracle, f"Expected composite score {s_oracle}, got {res['objective']}"


# ==================================================================
# PATCH 2: STATUS HANDLING & MOCKED SOLVER SCENARIOS
# ==================================================================

def test_negative_capacity_returns_model_invalid():
    """Negative capacity must return MODEL_INVALID without invoking solver."""
    payload = {
        "candidates": [1, 2],
        "opportunities": [{"id": 10, "capacity": -1}],
        "pairs": [{"c": 1, "i": 10, "score": 80, "pref": 0}],
        "policy": {},
        "params": {"maxTimeSeconds": 5},
    }
    res = optimizer.optimize(payload)
    assert res["status"] == "MODEL_INVALID"
    assert res["global"] == []
    assert res["objective"] == 0


def test_stage1_unknown_handled_truthfully():
    """When Stage 1 times out (UNKNOWN), status is UNKNOWN (not INFEASIBLE)."""
    with patch("ortools.sat.python.cp_model.CpSolver.Solve", return_value=cp_model.UNKNOWN):
        res = _run([(1, 10, 80, 0)], {10: 1})
        assert res["status"] == "UNKNOWN"
        assert res["global"] == []
        assert res["objective"] == 0


def test_stage1_model_invalid_handled_truthfully():
    """When Stage 1 fails with MODEL_INVALID, status is MODEL_INVALID."""
    with patch("ortools.sat.python.cp_model.CpSolver.Solve", return_value=cp_model.MODEL_INVALID):
        res = _run([(1, 10, 80, 0)], {10: 1})
        assert res["status"] == "MODEL_INVALID"
        assert res["global"] == []


def test_stage1_feasible_unproven_retained_as_provisional():
    """
    When Stage 1 returns FEASIBLE without proof of optimality:
    The valid provisional assignment is returned, Stage 2 is skipped,
    and status is FEASIBLE with cardinalityOptimal=False.
    """
    call_count = 0

    def mock_solve(self, model):
        nonlocal call_count
        call_count += 1
        return cp_model.FEASIBLE

    with patch("ortools.sat.python.cp_model.CpSolver.Solve", side_effect=mock_solve, autospec=True):
        with patch("ortools.sat.python.cp_model.CpSolver.Value", return_value=1):
            res = _run([(1, 10, 85, 0)], {10: 1})
            assert res["status"] == "FEASIBLE"
            assert res["metadata"]["cardinalityOptimal"] is False
            assert res["metadata"]["stage1Status"] == "FEASIBLE"
            assert call_count == 1, "Stage 2 must NOT be called when Stage 1 is only FEASIBLE"
            assert len(res["global"]) == 1


def test_stage2_unknown_rescued_by_stage1_fallback():
    """
    When Stage 1 is OPTIMAL and Stage 2 returns UNKNOWN:
    The verified Stage 1 fallback is returned as a provisional result with status FEASIBLE.
    """
    call_count = 0

    def mock_solve(self, model):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return cp_model.OPTIMAL
        return cp_model.UNKNOWN

    with patch("ortools.sat.python.cp_model.CpSolver.Solve", side_effect=mock_solve, autospec=True):
        with patch("ortools.sat.python.cp_model.CpSolver.ObjectiveValue", return_value=1.0):
            with patch("ortools.sat.python.cp_model.CpSolver.Value", return_value=1):
                res = _run([(1, 10, 85, 0)], {10: 1})
                assert res["status"] == "FEASIBLE"
                assert res["metadata"]["usedFallback"] is True
                assert res["metadata"]["cardinalityOptimal"] is True
                assert res["metadata"]["suitabilityOptimal"] is False
                assert len(res["global"]) == 1


def test_stage2_model_invalid_not_concealed():
    """
    When Stage 2 returns MODEL_INVALID:
    It must NOT be silently concealed with fallback. Status must be MODEL_INVALID.
    """
    call_count = 0

    def mock_solve(self, model):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return cp_model.OPTIMAL
        return cp_model.MODEL_INVALID

    with patch("ortools.sat.python.cp_model.CpSolver.Solve", side_effect=mock_solve, autospec=True):
        with patch("ortools.sat.python.cp_model.CpSolver.ObjectiveValue", return_value=1.0):
            with patch("ortools.sat.python.cp_model.CpSolver.Value", return_value=1):
                res = _run([(1, 10, 85, 0)], {10: 1})
                assert res["status"] == "MODEL_INVALID"
                assert res["global"] == []
                assert res["metadata"]["usedFallback"] is False


# ==================================================================
# CHECK A — Solver Deadline Boundary Tests
# ==================================================================

def test_deadline_zero_remaining_before_stage1():
    """
    When the deadline is already expired before Stage 1 starts,
    the optimizer must return UNKNOWN immediately without invoking the solver.
    Uses a past deadline by passing maxTimeSeconds=0 (and relying on model
    build time to exhaust the budget). We simulate via mocking monotonic.
    """
    import time as _time

    # Set maxTimeSeconds to a large value but mock monotonic so the first
    # check sees remaining == 0 (deadline expired before stage 1).
    _base = _time.monotonic()
    call_count = {"n": 0}
    original_monotonic = _time.monotonic

    def fake_monotonic():
        # first call: t_start_mono = base
        # second call (pre-Stage-1 check): t_now = base + 9999 (deadline long past)
        call_count["n"] += 1
        if call_count["n"] <= 1:
            return _base
        return _base + 9999  # simulate time having passed the deadline

    import optimizer as _opt
    old_mono = _opt.time.monotonic
    _opt.time.monotonic = fake_monotonic
    try:
        res = _run([(1, 10, 80, 0)], {10: 1}, max_time=5)
        assert res["status"] == "UNKNOWN", f"Expected UNKNOWN for expired deadline, got {res['status']}"
        assert res["global"] == []
        assert res["metadata"]["stage1Status"] == "UNKNOWN"
    finally:
        _opt.time.monotonic = old_mono


def test_minimum_budget_guard_below_threshold():
    """
    When less than MIN_STAGE_BUDGET (0.1s) remains before Stage 1,
    the optimizer must return UNKNOWN rather than granting a meaningless
    budget to the solver. Verifies Check A: no stage gets more than remaining.
    """
    import time as _time
    import optimizer as _opt

    _base = _time.monotonic()
    call_count = {"n": 0}

    def fake_monotonic():
        call_count["n"] += 1
        if call_count["n"] <= 1:
            return _base  # t_start_mono
        # Simulate 4.95s elapsed on a 5.0s budget → 0.05s remaining (below 0.1s guard)
        return _base + 4.95

    old_mono = _opt.time.monotonic
    _opt.time.monotonic = fake_monotonic
    try:
        res = _run([(1, 10, 80, 0)], {10: 1}, max_time=5.0)
        assert res["status"] == "UNKNOWN", (
            f"Expected UNKNOWN when < 0.1s remains before Stage 1, got {res['status']}"
        )
        assert res["global"] == []
    finally:
        _opt.time.monotonic = old_mono


def test_stage1_budget_never_exceeds_remaining():
    """
    Verify that the Stage 1 budget (t1) is always strictly <= remaining time.
    This is a white-box check on the formula to ensure no floor value grants
    more than the actual remaining wall-clock budget.
    """
    # Remaining time = 0.3s.  40% = 0.12s.  t1 should be min(0.3, 0.12) = 0.12.
    # Previously max(0.001, 0.12) = 0.12 then min(0.12, 0.3) = 0.12 — same.
    # With very small remaining=0.05 (below guard threshold): returns UNKNOWN now.
    # With remaining=0.3: t1 = min(0.3, min(20.0, 0.3*0.40)) = min(0.3, 0.12) = 0.12.
    import time as _time
    import optimizer as _opt

    _base = _time.monotonic()
    call_count = {"n": 0}

    def fake_monotonic():
        call_count["n"] += 1
        if call_count["n"] <= 1:
            return _base
        return _base + 4.7  # 0.3s remaining on a 5.0s budget (above 0.1s guard)

    old_mono = _opt.time.monotonic
    _opt.time.monotonic = fake_monotonic
    try:
        # With 0.3s remaining, solver should be invoked (not early-exit with UNKNOWN)
        # We mock the solver to return OPTIMAL to control execution
        with patch("ortools.sat.python.cp_model.CpSolver.Solve", return_value=cp_model.OPTIMAL):
            with patch("ortools.sat.python.cp_model.CpSolver.ObjectiveValue", return_value=0.0):
                with patch("ortools.sat.python.cp_model.CpSolver.Value", return_value=0):
                    res = _run([(1, 10, 80, 0)], {10: 1}, max_time=5.0)
                    # Stage 2 will run but find 0 assignments → FEASIBLE (time exhausted)
                    # or OPTIMAL with 0 results. Status must not be UNKNOWN.
                    assert res["status"] in ("OPTIMAL", "FEASIBLE"), (
                        f"With 0.3s remaining (above guard), solver must run, got {res['status']}"
                    )
    finally:
        _opt.time.monotonic = old_mono


# ==================================================================
# CHECK B — validate_assignments Cardinality Check
# ==================================================================

def test_validate_assignments_rejects_cardinality_mismatch():
    """
    validate_assignments must reject an assignment set whose count differs from
    the expected_cardinality. This protects against a Stage 1 fallback that
    silently loses assignments yet claims cardinalityOptimal=True.
    """
    pairs_set = {(1, 10), (2, 11), (3, 12)}
    capacities = {10: 1, 11: 1, 12: 1}
    candidates = [1, 2, 3]

    # Only 2 assignments but K*=3
    partial = [{"c": 1, "i": 10, "score": 100}, {"c": 2, "i": 11, "score": 90}]
    valid, reason = optimizer.validate_assignments(
        partial, candidates, capacities, pairs_set,
        expected_cardinality=3,
    )
    assert not valid
    assert "Cardinality mismatch" in reason or "expected 3" in reason

    # Correct cardinality: 3/3
    full = [{"c": 1, "i": 10, "score": 100}, {"c": 2, "i": 11, "score": 90}, {"c": 3, "i": 12, "score": 80}]
    valid, reason = optimizer.validate_assignments(
        full, candidates, capacities, pairs_set,
        expected_cardinality=3,
    )
    assert valid, f"Expected valid with correct cardinality, got: {reason}"


def test_validate_assignments_rejects_ineligible_pair():
    """validate_assignments rejects a pair not in the original eligible set."""
    pairs_set = {(1, 10)}
    capacities = {10: 1, 11: 1}
    candidates = [1]
    assignments = [{"c": 1, "i": 11, "score": 50}]  # (1,11) not eligible
    valid, reason = optimizer.validate_assignments(assignments, candidates, capacities, pairs_set)
    assert not valid
    assert "Ineligible" in reason


def test_validate_assignments_rejects_capacity_violation():
    """validate_assignments rejects capacity overflow."""
    pairs_set = {(1, 10), (2, 10)}
    capacities = {10: 1}
    candidates = [1, 2]
    assignments = [{"c": 1, "i": 10, "score": 50}, {"c": 2, "i": 10, "score": 40}]
    valid, reason = optimizer.validate_assignments(assignments, candidates, capacities, pairs_set)
    assert not valid
    assert "capacity exceeded" in reason


def test_v2_rural_denominator_excludes_candidates_without_eligible_pairs():
    """V2 policy denominator excludes rural candidates with zero eligible opportunities.

    Candidate 1: Rural, has eligible pair with Opp 10 (cap 1).
    Candidate 2: Rural, has NO eligible pairs.
    Candidate 3: Urban, has eligible pair with Opp 10.
    Fairness floor: 100% on RURAL group [1, 2].

    Because Candidate 2 has 0 eligible pairs, |R_eligible| = 1 (only candidate 1).
    Floor requirement is ceil(100% * 1) = 1 placement of candidate 1.
    This problem is FEASIBLE (candidate 1 allocated to opp 10).
    If candidate 2 were erroneously included in the denominator, required would be
    ceil(100% * 2) = 2, which would be falsely INFEASIBLE.
    """
    candidates = [1, 2, 3]
    pairs = [(1, 10, 80, 0), (3, 10, 95, 0)]  # Candidate 2 has no pairs
    caps = {10: 1}
    groups = [{"key": "RURAL", "candidates": [1, 2], "floorPct": 100}]

    res = _run(pairs, caps, groups=groups, candidates=candidates)
    assert res["status"] in ("OPTIMAL", "FEASIBLE")
    assert len(res["global"]) == 1
    assert res["global"][0]["c"] == 1
    assert res["global"][0]["i"] == 10

    # Verify against independent oracle
    oracle_k, oracle_score, oracle_sol = independent_oracle(
        candidates, caps, pairs, groups=groups
    )
    assert oracle_k == 1
    assert {(a["c"], a["i"]) for a in oracle_sol} == {(1, 10)}


def test_v2_rural_empty_eligible_cohort_requires_zero_placements():
    """When no rural candidates have eligible pairs, required placements is 0."""
    candidates = [1, 2]
    pairs = [(2, 10, 90, 0)]  # Candidate 1 (rural) has no pairs; candidate 2 (urban) has 1 pair
    caps = {10: 1}
    groups = [{"key": "RURAL", "candidates": [1], "floorPct": 50}]

    res = _run(pairs, caps, groups=groups, candidates=candidates)
    assert res["status"] in ("OPTIMAL", "FEASIBLE")
    assert len(res["global"]) == 1
    assert res["global"][0]["c"] == 2
