"""
Unit test asserting that the Phase 4B-1A baseline benchmark dataset and metrics runner execute deterministically.
"""
import sys
from pathlib import Path

AI_SERVICE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AI_SERVICE_DIR))

from evaluation.benchmark_runner import run_benchmark, BENCHMARK_PATH, RESULTS_FILE


def test_benchmark_dataset_integrity():
    assert BENCHMARK_PATH.exists(), f"Benchmark dataset missing at {BENCHMARK_PATH}"
    import json
    with open(BENCHMARK_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert len(data["normalization_cases"]) == 60
    assert len(data["resume_extraction_cases"]) == 5


def test_baseline_benchmark_execution():
    report = run_benchmark()
    assert report is not None
    assert RESULTS_FILE.exists()

    norm_metrics = report["normalization_benchmark"]["metrics"]
    # Exact empirical baseline values
    assert norm_metrics["category_breakdown"]["in_vocabulary_sanity"]["accuracy"] == 1.0
    assert norm_metrics["category_breakdown"]["negative_controls"]["accuracy"] == 1.0
    assert norm_metrics["category_breakdown"]["out_of_vocabulary_semantic"]["accuracy"] == 0.10
    assert norm_metrics["category_breakdown"]["held_out_test"]["accuracy"] == 0.0
