"""
NextAlloc Phase 4B: Explicit Dual-Lane NLP Test Runner
Executes:
  Lane 1: Current active runtime tests (app/ai-service/tests excluding frozen historical harness).
  Lane 2: Historical Phase 4B-1A benchmark harness evaluated against original pinned commit 24aa965 via detached worktree.
"""
import os
import sys
import subprocess
import shutil
from pathlib import Path

def run_lane_1():
    print("=" * 80)
    print("LANE 1: ACTIVE RUNTIME PYTHON TESTS")
    print("=" * 80)
    cmd = [
        sys.executable, "-m", "pytest",
        "app/ai-service/tests/test_nlp.py",
        "app/ai-service/tests/test_nlp_relationships.py",
        "app/ai-service/tests/test_gap_guidance.py",
        "app/ai-service/tests/test_optimizer.py",
        "-v"
    ]
    res = subprocess.run(cmd, text=True)
    print(f"\n[LANE 1 EXIT CODE]: {res.returncode}")
    return res.returncode

def run_lane_2():
    print("\n" + "=" * 80)
    print("LANE 2: HISTORICAL PINNED-COMMIT BENCHMARK (Commit 24aa965)")
    print("=" * 80)
    scratch_dir = Path("app/scratch/worktree_lane2_24aa965").resolve()
    if scratch_dir.exists():
        subprocess.run(["git", "worktree", "remove", "--force", str(scratch_dir)], capture_output=True)
        if scratch_dir.exists():
            shutil.rmtree(scratch_dir, ignore_errors=True)

    try:
        wt_add = subprocess.run(
            ["git", "worktree", "add", "--detach", str(scratch_dir), "24aa965"],
            capture_output=True, text=True
        )
        if wt_add.returncode != 0:
            print(f"[ERROR] Failed to create git worktree: {wt_add.stderr}")
            return wt_add.returncode

        test_path = scratch_dir / "app" / "ai-service" / "tests" / "test_evaluation_baseline.py"
        cmd = [sys.executable, "-m", "pytest", str(test_path), "-v"]
        res = subprocess.run(cmd, text=True)
        print(f"\n[LANE 2 EXIT CODE]: {res.returncode}")
        return res.returncode
    finally:
        subprocess.run(["git", "worktree", "remove", "--force", str(scratch_dir)], capture_output=True)
        if scratch_dir.exists():
            shutil.rmtree(scratch_dir, ignore_errors=True)

def main():
    code1 = run_lane_1()
    code2 = run_lane_2()
    print("\n" + "=" * 80)
    print("TEST LANES SUMMARY")
    print(f"  Lane 1 (Active Runtime)  : {'PASSED (Exit 0)' if code1 == 0 else f'FAILED (Exit {code1})'}")
    print(f"  Lane 2 (Pinned Baseline) : {'PASSED (Exit 0)' if code2 == 0 else f'FAILED (Exit {code2})'}")
    print("=" * 80)
    if code1 != 0 or code2 != 0:
        sys.exit(1)

if __name__ == "__main__":
    main()

