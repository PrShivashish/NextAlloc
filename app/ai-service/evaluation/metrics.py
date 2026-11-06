"""
NextAlloc Semantic Evaluation Metrics
Mathematically rigorous computation of classification, retrieval, and extraction metrics.
"""

def compute_normalization_metrics(results: list[dict]) -> dict:
    """
    Computes accuracy, precision on negatives, and category breakdown for normalization queries.
    """
    total = len(results)
    if total == 0:
        return {}

    categories = {}
    total_correct = 0

    for r in results:
        cat = r["category"]
        if cat not in categories:
            categories[cat] = {"total": 0, "correct": 0, "errors": []}

        is_correct = (r["predicted"] == r["expected"])
        categories[cat]["total"] += 1
        if is_correct:
            categories[cat]["correct"] += 1
            total_correct += 1
        else:
            categories[cat]["errors"].append({
                "id": r["id"],
                "query": r["query"],
                "expected": r["expected"],
                "predicted": r["predicted"]
            })

    category_summary = {}
    for cat, stats in categories.items():
        acc = (stats["correct"] / stats["total"]) if stats["total"] > 0 else 0.0
        category_summary[cat] = {
            "total": stats["total"],
            "correct": stats["correct"],
            "accuracy": round(acc, 4),
            "error_count": len(stats["errors"])
        }

    # Negative control specificity (True Negative Rate)
    neg_stats = categories.get("negative_controls", {"total": 0, "correct": 0})
    negative_rejection_rate = (neg_stats["correct"] / neg_stats["total"]) if neg_stats["total"] > 0 else 1.0

    return {
        "total_queries": total,
        "overall_accuracy": round(total_correct / total, 4),
        "negative_rejection_rate": round(negative_rejection_rate, 4),
        "category_breakdown": category_summary,
        "raw_categories": categories
    }


def compute_extraction_metrics(extraction_results: list[dict]) -> dict:
    """
    Computes set-level Precision, Recall, and F1 for skill extraction across texts.
    """
    total_tp = 0
    total_fp = 0
    total_fn = 0
    sample_metrics = []

    for item in extraction_results:
        expected = set(item["expected"])
        predicted = set(item["predicted"])

        tp = len(expected & predicted)
        fp = len(predicted - expected)
        fn = len(expected - predicted)

        total_tp += tp
        total_fp += fp
        total_fn += fn

        prec = (tp / (tp + fp)) if (tp + fp) > 0 else (1.0 if not expected and not predicted else 0.0)
        rec = (tp / (tp + fn)) if (tp + fn) > 0 else (1.0 if not expected else 0.0)
        f1 = (2 * prec * rec / (prec + rec)) if (prec + rec) > 0 else 0.0

        sample_metrics.append({
            "id": item["id"],
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1": round(f1, 4),
            "missing": list(expected - predicted),
            "spurious": list(predicted - expected)
        })

    macro_precision = sum(s["precision"] for s in sample_metrics) / len(sample_metrics) if sample_metrics else 0.0
    macro_recall = sum(s["recall"] for s in sample_metrics) / len(sample_metrics) if sample_metrics else 0.0
    macro_f1 = sum(s["f1"] for s in sample_metrics) / len(sample_metrics) if sample_metrics else 0.0

    micro_precision = (total_tp / (total_tp + total_fp)) if (total_tp + total_fp) > 0 else 0.0
    micro_recall = (total_tp / (total_tp + total_fn)) if (total_tp + total_fn) > 0 else 0.0
    micro_f1 = (2 * micro_precision * micro_recall / (micro_precision + micro_recall)) if (micro_precision + micro_recall) > 0 else 0.0

    return {
        "macro_precision": round(macro_precision, 4),
        "macro_recall": round(macro_recall, 4),
        "macro_f1": round(macro_f1, 4),
        "micro_precision": round(micro_precision, 4),
        "micro_recall": round(micro_recall, 4),
        "micro_f1": round(micro_f1, 4),
        "sample_breakdown": sample_metrics
    }
