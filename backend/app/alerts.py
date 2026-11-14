"""Centralized merchant alert logic for QRaksha-Kavach.

Implements SPEC Section 6.3 rate limiting:
- Rate limit: 1 alert per merchant per 30 minutes (configurable via thresholds.yaml).
- Repeated scans within the 30-minute window increment the alert count.
- Scans after the window create a new distinct alert.
"""

from datetime import datetime, timedelta, timezone
import json
from typing import Any, Optional

from sqlmodel import Session, select

from app.config.loader import load_thresholds
from app.models import Alert, Merchant


def record_merchant_alert(
    session: Session,
    merchant: Merchant,
    scanned_upi: str,
    scan_id: Optional[int] = None,
    alert_type: str = "qr_swap",
    extra_details: Optional[dict[str, Any]] = None,
) -> Alert:
    """Create or update a merchant alert with rate limiting and deduplication.

    If an alert of the same type for this merchant was created within
    alert_rate_limit_minutes (default: 30 minutes), increment its counter.
    Otherwise, create a new Alert record with count = 1.
    """
    thresholds = load_thresholds()
    rate_limit_min = int(thresholds.get("alert_rate_limit_minutes", 30))
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=rate_limit_min)

    # Query most recent alert for this merchant of the specified type
    query = (
        select(Alert)
        .where(Alert.merchant_id == merchant.id)
        .where(Alert.type == alert_type)
        .order_by(Alert.created_at.desc())
    )
    existing_alert = session.exec(query).first()

    details_payload = {
        "shop_code": merchant.shop_code,
        "registered_upi": merchant.upi_id,
        "scanned_upi": scanned_upi,
        "latest_scan_at": now.isoformat(),
    }
    if extra_details:
        details_payload.update(extra_details)

    if existing_alert and existing_alert.created_at:
        # Check if existing alert falls within the rate limit window
        alert_time = existing_alert.created_at
        if alert_time.tzinfo is None:
            alert_time = alert_time.replace(tzinfo=timezone.utc)

        if alert_time >= cutoff:
            # Increment existing alert counter
            existing_alert.count += 1
            existing_alert.details_json = json.dumps(details_payload)
            session.add(existing_alert)
            session.commit()
            session.refresh(existing_alert)
            return existing_alert

    # Create new alert
    new_alert = Alert(
        merchant_id=merchant.id,
        scan_id=scan_id,
        type=alert_type,
        risk_level="danger",
        count=1,
        seen=False,
        details_json=json.dumps(details_payload),
        signals_json=json.dumps([{"detector": "registry_binding", "severity": "danger"}]),
        explanation_key="payee_not_registered_here",
        created_at=now,
    )
    session.add(new_alert)
    session.commit()
    session.refresh(new_alert)
    return new_alert
