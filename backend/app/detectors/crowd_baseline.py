"""Crowd baseline detector (SPEC Section 6.4).

Detects recent changes in payee accounts at unregistered locations:
- Groups scans by coarse location cell (rounded to 3 decimal places, ~111 m).
- Checks scan history within baseline_days (default 30 days).
- If at least baseline_min_scans (default 8) share one UPI ID for at least
  baseline_share (default 70% / 0.70) of scans, and a new scan shows a
  different UPI ID, return CAUTION with evidence "payee here changed recently".
- CRITICAL: Never return danger here, because shops can legitimately change accounts.
"""

from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlmodel import Session, select

from app.config.loader import load_thresholds
from app.models import Scan
from app.signals import Signal


def detect(
    upi_id: str,
    coarse_lat: Optional[float] = None,
    coarse_lng: Optional[float] = None,
    scan_history: Optional[list[Scan]] = None,
    session: Optional[Session] = None,
    now: Optional[datetime] = None,
) -> Signal:
    """Run crowd baseline detection on recent scan history for a location cell.

    Parameters:
      upi_id: The scanned UPI VPA being evaluated.
      coarse_lat: Latitude of the current scan.
      coarse_lng: Longitude of the current scan.
      scan_history: Optional list of Scan objects for unit testing.
      session: Optional SQLModel Session to query scan history from DB.
      now: Optional current timestamp (defaults to UTC now).

    Returns:
      Signal object with severity "ok" or "caution". Never returns "danger".
    """
    if coarse_lat is None or coarse_lng is None:
        return Signal.ok(
            detector="crowd_baseline",
            evidence=["insufficient baseline data"],
            explanation_key="insufficient_baseline_data",
        )

    thresholds = load_thresholds()
    min_scans = int(thresholds.get("baseline_min_scans", 8))
    baseline_days = int(thresholds.get("baseline_days", 30))
    baseline_share = float(thresholds.get("baseline_share", 0.7))

    cell_lat = round(coarse_lat, 3)
    cell_lng = round(coarse_lng, 3)

    current_time = now or datetime.now(timezone.utc)
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=timezone.utc)
    cutoff = current_time - timedelta(days=baseline_days)

    relevant_scans: list[Scan] = []

    if scan_history is not None:
        for s in scan_history:
            if s.coarse_lat is None or s.coarse_lng is None:
                continue
            if round(s.coarse_lat, 3) != cell_lat or round(s.coarse_lng, 3) != cell_lng:
                continue
            if s.created_at is not None:
                scan_time = s.created_at
                if scan_time.tzinfo is None:
                    scan_time = scan_time.replace(tzinfo=timezone.utc)
                if scan_time < cutoff:
                    continue
            relevant_scans.append(s)
    elif session is not None:
        query = (
            select(Scan)
            .where(Scan.coarse_lat == cell_lat)
            .where(Scan.coarse_lng == cell_lng)
            .where(Scan.created_at >= cutoff)
        )
        relevant_scans = list(session.exec(query).all())

    if len(relevant_scans) < min_scans:
        return Signal.ok(
            detector="crowd_baseline",
            evidence=["insufficient baseline data"],
            explanation_key="insufficient_baseline_data",
        )

    counts = Counter(
        s.upi_id.strip().lower()
        for s in relevant_scans
        if s.upi_id
    )
    if not counts:
        return Signal.ok(
            detector="crowd_baseline",
            evidence=["insufficient baseline data"],
            explanation_key="insufficient_baseline_data",
        )

    top_upi, top_count = counts.most_common(1)[0]
    total_scans = len(relevant_scans)
    share = top_count / total_scans

    clean_scanned_upi = upi_id.strip().lower()

    if share >= baseline_share:
        if clean_scanned_upi != top_upi:
            evidence = [
                "payee here changed recently",
                f"Historical payee {top_upi} accounted for {int(share * 100)}% of scans at this location",
            ]
            return Signal.caution(
                detector="crowd_baseline",
                score=0.6,
                evidence=evidence,
                explanation_key="payee_changed_recently",
            )
        else:
            return Signal.ok(
                detector="crowd_baseline",
                evidence=["consistent with crowd baseline"],
                explanation_key="crowd_baseline_ok",
            )

    return Signal.ok(
        detector="crowd_baseline",
        evidence=["no dominant payee at this location"],
        explanation_key="insufficient_baseline_data",
    )
