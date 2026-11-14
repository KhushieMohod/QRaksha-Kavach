"""Tests for crowd baseline detector (SPEC Section 6.4).

Verifies:
  - Scans grouped by coarse location cell (3 decimal places, ~111 m).
  - Fewer than baseline_min_scans (8) returns ok ("insufficient baseline data").
  - Baseline established (>= 8 scans, >= 70% share for one payee):
      - New scan with same payee returns ok ("consistent with crowd baseline").
      - New scan with changed payee returns caution ("payee here changed recently").
  - Mixed history without a 70% dominant payee returns ok.
  - History older than baseline_days (30 days) is excluded from baseline calculation.
  - Scans in a different coarse cell are not grouped.
  - Missing coordinates (None) returns ok.
  - GOLDEN RULE: crowd_baseline NEVER returns danger severity in any case.
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlmodel import Session, SQLModel, create_engine

from app.detectors.crowd_baseline import detect
from app.models import Scan


@pytest.fixture(name="engine")
def fixture_engine(tmp_path: Path):
    """Create a temporary SQLite engine."""
    db_file = tmp_path / "test_crowd.db"
    engine = create_engine(f"sqlite:///{db_file}", echo=False)
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture(name="session")
def fixture_session(engine):
    """Yield a database session bound to the temporary engine."""
    with Session(engine) as session:
        yield session


def _make_scans(
    upi_id: str,
    count: int,
    coarse_lat: float = 17.400,
    coarse_lng: float = 78.500,
    days_ago: int = 2,
) -> list[Scan]:
    """Helper to generate a list of mock Scan objects."""
    now = datetime.now(timezone.utc)
    scans = []
    for i in range(count):
        scans.append(
            Scan(
                upi_id=upi_id,
                coarse_lat=round(coarse_lat, 3),
                coarse_lng=round(coarse_lng, 3),
                created_at=now - timedelta(days=days_ago, hours=i),
            )
        )
    return scans


class TestCrowdBaselineDetector:
    """Test crowd baseline detector cases matching SPEC Section 6.4."""

    def test_fewer_than_min_scans_returns_ok(self) -> None:
        """Fewer than 8 scans cannot establish a baseline."""
        history = _make_scans("stall@okaxis", count=7)
        sig = detect(
            upi_id="newguy@okaxis",
            coarse_lat=17.400,
            coarse_lng=78.500,
            scan_history=history,
        )

        assert sig.severity == "ok"
        assert sig.score == 0.0
        assert "insufficient baseline data" in sig.evidence
        assert sig.explanation_key == "insufficient_baseline_data"

    def test_dominant_payee_same_upi_returns_ok(self) -> None:
        """10 scans, 100% stall@okaxis, new scan is stall@okaxis -> ok."""
        history = _make_scans("stall@okaxis", count=10)
        sig = detect(
            upi_id="stall@okaxis",
            coarse_lat=17.400,
            coarse_lng=78.500,
            scan_history=history,
        )

        assert sig.severity == "ok"
        assert sig.score == 0.0
        assert "consistent with crowd baseline" in sig.evidence
        assert sig.explanation_key == "crowd_baseline_ok"

    def test_dominant_payee_different_upi_returns_caution(self) -> None:
        """10 scans (8 stall@okaxis, 2 other => 80% share >= 70%), new scan is stranger@ybl -> caution."""
        history = _make_scans("stall@okaxis", count=8) + _make_scans("other@okaxis", count=2)
        sig = detect(
            upi_id="stranger@ybl",
            coarse_lat=17.400,
            coarse_lng=78.500,
            scan_history=history,
        )

        assert sig.severity == "caution"
        assert sig.score == 0.6
        assert any("payee here changed recently" in ev for ev in sig.evidence)
        assert sig.explanation_key == "payee_changed_recently"

    def test_mixed_history_below_share_threshold_returns_ok(self) -> None:
        """10 scans: 5 for A (50%), 5 for B (50%) -> below 70% share -> ok."""
        history = _make_scans("vendorA@okaxis", count=5) + _make_scans("vendorB@okaxis", count=5)
        sig = detect(
            upi_id="vendorC@okaxis",
            coarse_lat=17.400,
            coarse_lng=78.500,
            scan_history=history,
        )

        assert sig.severity == "ok"
        assert "no dominant payee at this location" in sig.evidence

    def test_scans_older_than_30_days_excluded(self) -> None:
        """10 scans made 35 days ago (outside 30-day window) are ignored."""
        old_scans = _make_scans("oldvendor@okaxis", count=10, days_ago=35)
        sig = detect(
            upi_id="newvendor@okaxis",
            coarse_lat=17.400,
            coarse_lng=78.500,
            scan_history=old_scans,
        )

        assert sig.severity == "ok"
        assert "insufficient baseline data" in sig.evidence

    def test_scans_in_different_coarse_cell_not_grouped(self) -> None:
        """Scans in cell (17.450, 78.550) do not affect scan in (17.400, 78.500)."""
        different_cell_scans = _make_scans(
            "diffcell@okaxis", count=12, coarse_lat=17.450, coarse_lng=78.550
        )
        sig = detect(
            upi_id="local@okaxis",
            coarse_lat=17.400,
            coarse_lng=78.500,
            scan_history=different_cell_scans,
        )

        assert sig.severity == "ok"
        assert "insufficient baseline data" in sig.evidence

    def test_no_gps_returns_ok(self) -> None:
        """Missing location returns ok with insufficient baseline data."""
        history = _make_scans("stall@okaxis", count=10)
        sig = detect(
            upi_id="stall@okaxis",
            coarse_lat=None,
            coarse_lng=None,
            scan_history=history,
        )

        assert sig.severity == "ok"
        assert "insufficient baseline data" in sig.evidence

    def test_never_returns_danger(self) -> None:
        """Crucial spec constraint: crowd_baseline must NEVER return danger."""
        # Test various sudden changes and edge cases
        cases = [
            ("new_payee@ybl", _make_scans("dominant@okaxis", 20)),
            ("totally_unknown@bank", _make_scans("vendor@okaxis", 100)),
            ("changed@okaxis", _make_scans("legit@okaxis", 8)),
        ]
        for test_upi, history in cases:
            sig = detect(
                upi_id=test_upi,
                coarse_lat=17.400,
                coarse_lng=78.500,
                scan_history=history,
            )
            assert sig.severity != "danger", f"Crowd baseline returned danger for {test_upi}!"
            assert sig.severity in ("ok", "caution")
