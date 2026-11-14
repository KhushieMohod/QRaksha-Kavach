"""Simulate scan events for demonstration, crowd baseline, and alert testing.

Usage:
    python backend/scripts/simulate_scans.py --type swap_burst --shop-code KIR-0001 --count 5
    python backend/scripts/simulate_scans.py --type crowd_drift --count 10
    python backend/scripts/simulate_scans.py --type all
"""

import argparse
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlmodel import Session, create_engine, select

from app.database import engine as default_engine
from app.detectors import crowd_baseline, registry_binding
from app.models import Alert, Merchant, Scan


def simulate_swap_burst(
    session: Session,
    shop_code: str = "KIR-0001",
    fake_upi: str = "fraudster@ybl",
    burst_count: int = 5,
) -> Alert:
    """Simulate a burst of QR scans with a swapped payee at a verified shop.

    Tests that duplicate scans within the 30-minute window aggregate into
    exactly one alert with an incremented counter.
    """
    merchant = session.exec(
        select(Merchant).where(Merchant.shop_code == shop_code.upper())
    ).first()
    if not merchant:
        raise ValueError(f"Merchant '{shop_code}' not found.")

    last_alert: Optional[Alert] = None
    for _ in range(burst_count):
        # Scan near the shop with fraudulent UPI ID
        scan = Scan(
            upi_id=fake_upi,
            coarse_lat=merchant.coarse_lat,
            coarse_lng=merchant.coarse_lng,
            raw_payload=f"upi://pay?pa={fake_upi}&pn=FakeStore",
            verdict="danger",
        )
        session.add(scan)
        session.commit()
        session.refresh(scan)

        # Run registry_binding detector which triggers alert recording
        sig = registry_binding.detect(
            upi_id=fake_upi,
            coarse_lat=merchant.coarse_lat,
            coarse_lng=merchant.coarse_lng,
            shop_code=merchant.shop_code,
            session=session,
            scan_id=scan.id,
            trigger_alert=True,
        )
        assert sig.severity == "danger"

    # Fetch the latest alert for this merchant
    last_alert = session.exec(
        select(Alert)
        .where(Alert.merchant_id == merchant.id)
        .where(Alert.type == "qr_swap")
        .order_by(Alert.created_at.desc())
    ).first()

    return last_alert


def simulate_crowd_baseline(
    session: Session,
    coarse_lat: float = 17.400,
    coarse_lng: float = 78.500,
    dominant_upi: str = "chaiwala@okaxis",
    count: int = 10,
    days_span: int = 5,
) -> list[Scan]:
    """Populate scan history at an unregistered location to establish a baseline."""
    cell_lat = round(coarse_lat, 3)
    cell_lng = round(coarse_lng, 3)
    now = datetime.now(timezone.utc)
    scans: list[Scan] = []

    for i in range(count):
        scan_time = now - timedelta(days=(i % days_span), hours=i)
        scan = Scan(
            upi_id=dominant_upi,
            coarse_lat=cell_lat,
            coarse_lng=cell_lng,
            raw_payload=f"upi://pay?pa={dominant_upi}&pn=CornerChai",
            verdict="safe",
            created_at=scan_time,
        )
        session.add(scan)
        scans.append(scan)

    session.commit()
    return scans


def simulate_crowd_drift(
    session: Session,
    coarse_lat: float = 17.400,
    coarse_lng: float = 78.500,
    dominant_upi: str = "chaiwala@okaxis",
    new_upi: str = "unknown_stranger@ybl",
    history_count: int = 10,
) -> tuple[list[Scan], Scan]:
    """Establish a crowd baseline, then simulate a new scan with a changed payee."""
    history = simulate_crowd_baseline(
        session=session,
        coarse_lat=coarse_lat,
        coarse_lng=coarse_lng,
        dominant_upi=dominant_upi,
        count=history_count,
    )

    new_scan = Scan(
        upi_id=new_upi,
        coarse_lat=round(coarse_lat, 3),
        coarse_lng=round(coarse_lng, 3),
        raw_payload=f"upi://pay?pa={new_upi}&pn=Stranger",
        verdict="suspicious",
    )
    session.add(new_scan)
    session.commit()
    session.refresh(new_scan)

    sig = crowd_baseline.detect(
        upi_id=new_upi,
        coarse_lat=coarse_lat,
        coarse_lng=coarse_lng,
        session=session,
    )
    assert sig.severity == "caution"
    return history, new_scan


def main() -> None:
    parser = argparse.ArgumentParser(description="Simulate scan events for QRaksha-Kavach.")
    parser.add_argument(
        "--type",
        choices=["swap_burst", "crowd_drift", "all"],
        default="swap_burst",
        help="Type of simulation to run",
    )
    parser.add_argument(
        "--shop-code",
        default="KIR-0001",
        help="Target shop code for swap burst",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=5,
        help="Number of scans in burst / baseline",
    )
    args = parser.parse_args()

    with Session(default_engine) as session:
        if args.type in ("swap_burst", "all"):
            print(f"Simulating swap burst at {args.shop_code} with {args.count} scans...")
            alert = simulate_swap_burst(
                session, shop_code=args.shop_code, burst_count=args.count
            )
            print(f"-> Alert created: id={alert.id}, count={alert.count}, type={alert.type}")

        if args.type in ("crowd_drift", "all"):
            print(f"Simulating crowd baseline drift ({args.count} historical scans)...")
            history, new_scan = simulate_crowd_drift(session, history_count=args.count)
            print(f"-> Baseline created with {len(history)} scans; drifted scan id={new_scan.id}")

    print("Simulation complete.")


if __name__ == "__main__":
    main()
