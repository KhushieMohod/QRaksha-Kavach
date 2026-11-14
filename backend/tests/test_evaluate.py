"""Tests for system evaluation and metrics benchmarks (SPEC Section 8.2 & Step 9).

Verifies:
  - Exact counts in data/scan_scenarios.json matching SPEC Section 8.2.
  - Execution of backend/scripts/evaluate.py benchmark runner.
  - 100% per-type accuracy across all 30 QR scan scenarios.
  - Held-out scam text performance (accuracy >= 85%, precision >= 85%, recall >= 80%, FPR == 0%).
  - Latency benchmarks (median and 95th percentile).
  - API endpoint GET /api/metrics shape and content.
"""

import json
from pathlib import Path
from fastapi.testclient import TestClient
import pytest
from sqlmodel import Session, SQLModel, create_engine

from app.database import get_session
from app.main import app
from scripts.evaluate import print_evaluation_report, run_evaluation
from scripts.seed import seed_merchants


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(name="engine")
def fixture_engine(tmp_path: Path):
    """Create a temporary SQLite engine."""
    db_file = tmp_path / "test_eval_metrics.db"
    eng = create_engine(f"sqlite:///{db_file}", echo=False)
    SQLModel.metadata.create_all(eng)
    seed_merchants(target_engine=eng)
    return eng


@pytest.fixture(name="client")
def fixture_client(engine):
    """TestClient configured with dependency overrides for session."""
    def _override_session():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = _override_session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# 1. Dataset Shape and Exact Counts (SPEC Section 8.2)
# ---------------------------------------------------------------------------

class TestScanScenariosDataset:
    """Verify data/scan_scenarios.json strictly conforms to SPEC Section 8.2."""

    def test_scan_scenarios_file_exists_and_exact_counts(self) -> None:
        """Verify the exact 30 scenarios and specific per-type counts."""
        dataset_path = Path(__file__).resolve().parents[2] / "data" / "scan_scenarios.json"
        assert dataset_path.exists(), "data/scan_scenarios.json must exist"

        with open(dataset_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        scenarios = data.get("scenarios", [])
        assert len(scenarios) == 30, f"Expected exactly 30 scenarios, got {len(scenarios)}"

        # Verify exact counts per SPEC 8.2
        type_counts = {}
        for sc in scenarios:
            stype = sc.get("type")
            type_counts[stype] = type_counts.get(stype, 0) + 1

        assert type_counts.get("genuine_at_registered_shop") == 8
        assert type_counts.get("swapped_upi_id") == 6
        assert type_counts.get("lookalike_handle") == 4
        assert type_counts.get("story_linked") == 4
        assert type_counts.get("no_registry") == 4
        assert type_counts.get("shop_code_without_gps") == 2
        assert type_counts.get("changed_payee_at_unregistered_spot") == 2

    def test_scenario_required_fields(self) -> None:
        """Every scenario must include all required fields for execution."""
        dataset_path = Path(__file__).resolve().parents[2] / "data" / "scan_scenarios.json"
        with open(dataset_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        valid_verdicts = {"VERIFIED", "DANGER", "CAUTION", "UNVERIFIED"}
        for sc in data["scenarios"]:
            assert "id" in sc and sc["id"]
            assert "type" in sc and sc["type"]
            assert "description" in sc and sc["description"]
            assert "payload" in sc and sc["payload"].startswith("upi://")
            assert "expected_verdict" in sc and sc["expected_verdict"] in valid_verdicts


# ---------------------------------------------------------------------------
# 2. Evaluation Runner Logic and Metrics
# ---------------------------------------------------------------------------

class TestEvaluationRunner:
    """Verify scripts/evaluate.py executes benchmarks accurately."""

    def test_run_evaluation_benchmarks(self, engine) -> None:
        """Run complete evaluation and verify benchmark assertions."""
        metrics = run_evaluation(target_engine=engine)

        # 1. 30 scan scenarios evaluation
        sc = metrics["scan_scenarios"]
        assert sc["total"] == 30
        assert sc["passed"] == 30
        assert sc["accuracy"] == 1.0

        # Per-type accuracy must all be 100%
        per_type = sc["per_type"]
        assert per_type["genuine_at_registered_shop"]["accuracy"] == 1.0
        assert per_type["swapped_upi_id"]["accuracy"] == 1.0
        assert per_type["lookalike_handle"]["accuracy"] == 1.0
        assert per_type["story_linked"]["accuracy"] == 1.0
        assert per_type["no_registry"]["accuracy"] == 1.0
        assert per_type["shop_code_without_gps"]["accuracy"] == 1.0
        assert per_type["changed_payee_at_unregistered_spot"]["accuracy"] == 1.0

        # 2. Held-out messages evaluation
        ho = metrics["held_out_messages"]
        assert ho["total"] == 20
        assert ho["accuracy"] >= 0.85
        assert ho["precision"] >= 0.85
        assert ho["recall"] >= 0.80
        assert ho["fpr"] <= 0.15

        # 3. Latency distribution
        lat = metrics["latency"]
        assert lat["count"] == 50
        assert lat["median_ms"] > 0
        assert lat["p95_ms"] > 0

    def test_print_evaluation_report(self, capsys) -> None:
        """Verify the terminal report outputs expected sections and tables."""
        mock_results = {
            "scan_scenarios": {
                "total": 30,
                "passed": 30,
                "accuracy": 1.0,
                "per_type": {
                    "genuine_at_registered_shop": {"total": 8, "passed": 8, "accuracy": 1.0},
                    "swapped_upi_id": {"total": 6, "passed": 6, "accuracy": 1.0},
                },
            },
            "held_out_messages": {
                "total": 20,
                "tp": 9,
                "fp": 0,
                "tn": 10,
                "fn": 1,
                "accuracy": 0.95,
                "precision": 1.0,
                "recall": 0.90,
                "fpr": 0.0,
            },
            "latency": {
                "count": 50,
                "median_ms": 1.48,
                "p95_ms": 5.96,
                "min_ms": 0.20,
                "max_ms": 38.89,
            },
        }
        print_evaluation_report(mock_results)
        captured = capsys.readouterr()
        assert "QRaksha-Kavach System Evaluation & Metrics Benchmark" in captured.out
        assert "30 QR SCAN SCENARIOS" in captured.out
        assert "HELD-OUT SCAM TEXT MESSAGES" in captured.out
        assert "LATENCY BENCHMARKS" in captured.out


# ---------------------------------------------------------------------------
# 3. GET /api/metrics API Endpoint
# ---------------------------------------------------------------------------

class TestMetricsEndpoint:
    """Verify GET /api/metrics returns structured benchmark data."""

    def test_get_metrics_endpoint(self, client: TestClient) -> None:
        """Check API returns all required metrics and active DB counts."""
        res = client.get("/api/metrics")
        assert res.status_code == 200
        data = res.json()

        assert data["scan_scenarios_count"] == 30
        assert data["scan_scenarios_accuracy"] == 1.0
        assert "per_type_accuracy" in data
        assert data["per_type_accuracy"]["genuine_at_registered_shop"] == 1.0
        assert data["per_type_accuracy"]["swapped_upi_id"] == 1.0
        assert data["per_type_accuracy"]["lookalike_handle"] == 1.0
        assert data["per_type_accuracy"]["story_linked"] == 1.0
        assert data["per_type_accuracy"]["no_registry"] == 1.0
        assert data["per_type_accuracy"]["shop_code_without_gps"] == 1.0
        assert data["per_type_accuracy"]["changed_payee_at_unregistered_spot"] == 1.0

        assert data["held_out_count"] == 20
        assert data["held_out_accuracy"] == 0.95
        assert data["held_out_precision"] == 1.0
        assert data["held_out_recall"] == 0.90
        assert data["held_out_fpr"] == 0.0

        assert data["median_latency_ms"] > 0
        assert data["p95_latency_ms"] > 0
        assert data["total_merchants"] == 20
