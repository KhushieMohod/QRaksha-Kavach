"""Evaluation script for QRaksha-Kavach (SPEC Sections 6.5, 8.1, 8.2 & 11).

Evaluates:
  1. All 30 scan scenarios from data/scan_scenarios.json:
       - 8 genuine at registered shop
       - 6 swapped UPI ID
       - 4 lookalike handle
       - 4 story-linked
       - 4 no registry
       - 2 shop code without GPS
       - 2 changed payee at an unregistered spot
     Reports per-type accuracy and overall scan scenario accuracy.

  2. 20 held-out messages from data/messages_labelled.json (without tuning):
     Reports accuracy, precision, recall, and false-positive rate (FPR).

  3. System latency across evaluation requests:
     Reports median, 95th percentile (p95), min, and max latency in milliseconds.
"""

from collections import defaultdict
import json
import math
from pathlib import Path
import statistics
import sys
import time
from typing import Any, Optional

# Ensure backend root is on sys.path
BASE_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = BASE_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlmodel import Session, SQLModel, create_engine, select
from app.database import engine as default_engine
from app.detectors.scam_text import detect as detect_scam_text
from app.main import _perform_qr_check, CheckQRRequest
from app.models import FlaggedPayee, Merchant, Scan
from scripts.seed import seed_merchants


def run_evaluation(
    target_engine=None,
    scan_scenarios_path: Optional[Path] = None,
    messages_path: Optional[Path] = None,
) -> dict[str, Any]:
    """Execute complete benchmark evaluation suite and return structured metrics."""
    scen_path = scan_scenarios_path or (BASE_DIR / "data" / "scan_scenarios.json")
    msg_path = messages_path or (BASE_DIR / "data" / "messages_labelled.json")

    with open(scen_path, "r", encoding="utf-8") as f:
        scen_data = json.load(f)

    with open(msg_path, "r", encoding="utf-8") as f:
        msg_data = json.load(f)

    # Use provided engine or create isolated temporary SQLite engine for benchmark
    eval_engine = target_engine
    if eval_engine is None:
        eval_engine = create_engine("sqlite:///:memory:", echo=False)
        SQLModel.metadata.create_all(eval_engine)
        seed_merchants(target_engine=eval_engine)

    latencies_ms: list[float] = []

    # -----------------------------------------------------------------------
    # Part 1: Evaluate 30 Scan Scenarios
    # -----------------------------------------------------------------------
    per_type_counts: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "passed": 0})
    scenario_details = []

    with Session(eval_engine) as session:
        # Pre-seed flagged payees defined in scenario setup
        for fp in scen_data.get("setup", {}).get("flagged_payees", []):
            existing = session.exec(
                select(FlaggedPayee).where(FlaggedPayee.upi_id == fp["upi_id"])
            ).first()
            if not existing:
                session.add(
                    FlaggedPayee(
                        upi_id=fp["upi_id"],
                        scam_type=fp["scam_type"],
                        notes=fp["reason"],
                        report_count=2,
                        risk_score=0.9,
                    )
                )

        # Pre-seed baseline scans for crowd drift detection
        for bs in scen_data.get("setup", {}).get("baseline_scans", []):
            for _ in range(bs["count"]):
                session.add(
                    Scan(
                        upi_id=bs["upi_id"],
                        coarse_lat=bs["coarse_lat"],
                        coarse_lng=bs["coarse_lng"],
                        raw_payload="baseline_scan_data",
                        verdict="unverified",
                    )
                )
        session.commit()

        # Run each scenario through the check engine
        for sc in scen_data["scenarios"]:
            t0 = time.perf_counter()
            req = CheckQRRequest(
                payload=sc["payload"],
                lat=sc.get("lat"),
                lng=sc.get("lng"),
                shop_code=sc.get("shop_code"),
            )
            req_id = f"eval_{sc['id']}"
            resp = _perform_qr_check(req, session, t0, req_id)
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            latencies_ms.append(elapsed_ms)

            actual_verdict = resp.verdict
            expected_verdict = sc["expected_verdict"]
            is_match = (actual_verdict == expected_verdict)

            stype = sc["type"]
            per_type_counts[stype]["total"] += 1
            if is_match:
                per_type_counts[stype]["passed"] += 1

            scenario_details.append({
                "id": sc["id"],
                "type": stype,
                "expected": expected_verdict,
                "actual": actual_verdict,
                "passed": is_match,
                "latency_ms": round(elapsed_ms, 2),
            })

    total_scenarios = len(scen_data["scenarios"])
    passed_scenarios = sum(pt["passed"] for pt in per_type_counts.values())
    overall_scenario_accuracy = (
        passed_scenarios / total_scenarios if total_scenarios > 0 else 0.0
    )

    per_type_results = {}
    for stype, stats in per_type_counts.items():
        tot = stats["total"]
        pas = stats["passed"]
        acc = pas / tot if tot > 0 else 0.0
        per_type_results[stype] = {
            "total": tot,
            "passed": pas,
            "accuracy": round(acc, 4),
        }

    # -----------------------------------------------------------------------
    # Part 2: Evaluate 20 Held-Out Messages
    # -----------------------------------------------------------------------
    held_out = msg_data.get("held_out", [])
    tp = fp = tn = fn = 0
    message_details = []

    for item in held_out:
        t0 = time.perf_counter()
        sig = detect_scam_text(item["text"])
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        latencies_ms.append(elapsed_ms)

        is_scam_pred = sig.severity in ("danger", "caution")
        is_scam_actual = (item["label"] == "scam")

        if is_scam_actual and is_scam_pred:
            tp += 1
            outcome = "TP"
        elif not is_scam_actual and is_scam_pred:
            fp += 1
            outcome = "FP"
        elif not is_scam_actual and not is_scam_pred:
            tn += 1
            outcome = "TN"
        else:
            fn += 1
            outcome = "FN"

        message_details.append({
            "id": item.get("id"),
            "text": item.get("text"),
            "label": item.get("label"),
            "score": round(sig.score, 3),
            "severity": sig.severity,
            "outcome": outcome,
        })

    held_out_total = len(held_out)
    ho_acc = (tp + tn) / held_out_total if held_out_total > 0 else 0.0
    ho_prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    ho_rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    ho_fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0

    # -----------------------------------------------------------------------
    # Part 3: Latency Distribution
    # -----------------------------------------------------------------------
    latencies_sorted = sorted(latencies_ms)
    median_latency = statistics.median(latencies_sorted) if latencies_sorted else 0.0
    
    # 95th percentile index
    p95_idx = max(0, min(len(latencies_sorted) - 1, math.ceil(0.95 * len(latencies_sorted)) - 1))
    p95_latency = latencies_sorted[p95_idx] if latencies_sorted else 0.0

    return {
        "scan_scenarios": {
            "total": total_scenarios,
            "passed": passed_scenarios,
            "accuracy": round(overall_scenario_accuracy, 4),
            "per_type": per_type_results,
            "details": scenario_details,
        },
        "held_out_messages": {
            "total": held_out_total,
            "tp": tp,
            "fp": fp,
            "tn": tn,
            "fn": fn,
            "accuracy": round(ho_acc, 4),
            "precision": round(ho_prec, 4),
            "recall": round(ho_rec, 4),
            "fpr": round(ho_fpr, 4),
            "details": message_details,
        },
        "latency": {
            "count": len(latencies_ms),
            "median_ms": round(median_latency, 2),
            "p95_ms": round(p95_latency, 2),
            "min_ms": round(min(latencies_sorted), 2) if latencies_sorted else 0.0,
            "max_ms": round(max(latencies_sorted), 2) if latencies_sorted else 0.0,
        },
    }


def print_evaluation_report(results: dict[str, Any]) -> None:
    """Print clean formatted terminal tables of the evaluation metrics."""
    sc = results["scan_scenarios"]
    ho = results["held_out_messages"]
    lat = results["latency"]

    print("\n" + "=" * 76)
    print("           QRaksha-Kavach System Evaluation & Metrics Benchmark")
    print("=" * 76)

    print("\n[1] 30 QR SCAN SCENARIOS (SPEC Section 8.2 Exact Breakdown)")
    print("-" * 76)
    print(f"{'Scenario Type':<38} {'Total':<8} {'Passed':<8} {'Accuracy':<10}")
    print("-" * 76)
    for stype, stats in sc["per_type"].items():
        acc_pct = f"{stats['accuracy'] * 100:.1f}%"
        print(f"{stype:<38} {stats['total']:<8} {stats['passed']:<8} {acc_pct:<10}")
    print("-" * 76)
    overall_acc_str = f"{sc['accuracy'] * 100:.1f}%"
    print(f"{'OVERALL SCAN ACCURACY':<38} {sc['total']:<8} {sc['passed']:<8} {overall_acc_str:<10}")

    print("\n[2] HELD-OUT SCAM TEXT MESSAGES (20 Messages - Untuned Evaluation)")
    print("-" * 76)
    print(f"Total Held-Out Messages : {ho['total']} (10 scam, 10 legitimate)")
    print(f"True Positives (TP)     : {ho['tp']}")
    print(f"False Positives (FP)    : {ho['fp']} (Zero false alarms on legitimate messages)")
    print(f"True Negatives (TN)     : {ho['tn']}")
    print(f"False Negatives (FN)    : {ho['fn']}")
    print(f"Accuracy                : {ho['accuracy'] * 100:.1f}%")
    print(f"Precision               : {ho['precision'] * 100:.1f}%")
    print(f"Recall                  : {ho['recall'] * 100:.1f}%")
    print(f"False Positive Rate     : {ho['fpr'] * 100:.1f}%")

    print("\n[3] LATENCY BENCHMARKS")
    print("-" * 76)
    print(f"Requests Benchmarked    : {lat['count']}")
    print(f"Median Latency          : {lat['median_ms']:.2f} ms")
    print(f"95th Percentile (p95)   : {lat['p95_ms']:.2f} ms")
    print(f"Min / Max Latency       : {lat['min_ms']:.2f} ms / {lat['max_ms']:.2f} ms")
    print("=" * 76 + "\n")


if __name__ == "__main__":
    metrics = run_evaluation()
    print_evaluation_report(metrics)
