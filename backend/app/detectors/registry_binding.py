"""Registry binding detector (SPEC Section 6.3).

Verifies whether a scanned UPI QR / VPA matches the verified merchant registry:
- If shop_code is given, look up that merchant.
- Otherwise find the nearest merchant within registry_radius_m using haversine distance.
- If none is found, return ok with evidence "no registry data".
- If found and the UPI ID equals the registered one, return ok with evidence "matches registry".
- If found and different, return danger with evidence quoting the mismatch and distance,
  and record a merchant alert (rate-limited to 1 alert per 30 minutes with count).
"""

import math
from typing import Optional

from sqlmodel import Session, select

from app.alerts import record_merchant_alert
from app.config.loader import load_thresholds
from app.models import Merchant
from app.signals import Signal


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points in meters.

    Uses the Haversine formula with mean Earth radius R = 6,371,000 meters.
    Implemented directly in Python without external geographic libraries.
    """
    earth_radius_m = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    # Clamp a within [0, 1] to avoid float precision issues with math.sqrt
    a = min(1.0, max(0.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return earth_radius_m * c


def detect(
    upi_id: str,
    coarse_lat: Optional[float] = None,
    coarse_lng: Optional[float] = None,
    shop_code: Optional[str] = None,
    merchants: Optional[list[Merchant]] = None,
    session: Optional[Session] = None,
    scan_id: Optional[int] = None,
    trigger_alert: bool = True,
) -> Signal:
    """Run registry binding detection on the scanned UPI ID and location.

    Parameters:
      upi_id: Scanned UPI VPA (e.g. ramu@okaxis).
      coarse_lat: User coarse latitude.
      coarse_lng: User coarse longitude.
      shop_code: Optional merchant shop code entered or parsed (e.g. KIR-0042).
      merchants: Optional explicit list of Merchant models for standalone testing.
      session: Optional SQLModel Session to query DB and record alerts.
      scan_id: Optional scan ID for linking to alerts.
      trigger_alert: Whether to record a merchant alert upon mismatch.

    Returns:
      Signal object with severity "ok" or "danger".
    """
    thresholds = load_thresholds()
    radius_m = float(thresholds.get("registry_radius_m", 100))
    clean_upi = upi_id.strip().lower()

    # Case A: shop_code is explicitly provided
    if shop_code:
        target_merchant: Optional[Merchant] = None
        clean_code = shop_code.strip().upper()

        if merchants is not None:
            for m in merchants:
                if m.shop_code.strip().upper() == clean_code:
                    target_merchant = m
                    break
        elif session is not None:
            target_merchant = session.exec(
                select(Merchant).where(Merchant.shop_code == clean_code)
            ).first()

        if target_merchant is None:
            return Signal.ok(
                detector="registry_binding",
                evidence=["no registry data (unknown shop code)"],
                explanation_key="no_registry_data",
            )

        # Compare UPI ID
        if clean_upi == target_merchant.upi_id.strip().lower():
            return Signal.ok(
                detector="registry_binding",
                evidence=["matches registry"],
                explanation_key="matches_registry",
            )

        # Mismatch with specified shop
        evidence = [
            f"QR payee differs from registered payee for shop {target_merchant.shop_code}",
            "Scan has mismatched payee",
        ]
        if coarse_lat is not None and coarse_lng is not None:
            dist = haversine_distance(
                coarse_lat, coarse_lng,
                target_merchant.coarse_lat, target_merchant.coarse_lng,
            )
            evidence.append(f"Scan is {int(dist)} m from the shop")

        if session is not None and trigger_alert:
            record_merchant_alert(
                session=session,
                merchant=target_merchant,
                scanned_upi=upi_id,
                scan_id=scan_id,
                alert_type="qr_swap",
            )

        return Signal.danger(
            detector="registry_binding",
            score=0.95,
            evidence=evidence,
            explanation_key="payee_not_registered_here",
        )

    # Case B: shop_code not provided — look up nearest merchant within radius
    if coarse_lat is not None and coarse_lng is not None:
        candidate_merchants: list[Merchant] = []
        if merchants is not None:
            candidate_merchants = [m for m in merchants if m.is_active]
        elif session is not None:
            candidate_merchants = list(
                session.exec(select(Merchant).where(Merchant.is_active == True)).all()  # noqa: E712
            )

        if not candidate_merchants:
            return Signal.ok(
                detector="registry_binding",
                evidence=["no registry data"],
                explanation_key="no_registry_data",
            )

        nearest_merchant: Optional[Merchant] = None
        min_distance = float("inf")

        for m in candidate_merchants:
            dist = haversine_distance(coarse_lat, coarse_lng, m.coarse_lat, m.coarse_lng)
            if dist < min_distance:
                min_distance = dist
                nearest_merchant = m

        if nearest_merchant is not None and min_distance <= radius_m:
            if clean_upi == nearest_merchant.upi_id.strip().lower():
                return Signal.ok(
                    detector="registry_binding",
                    evidence=["matches registry"],
                    explanation_key="matches_registry",
                )

            # Different UPI ID at registered shop within radius
            evidence = [
                f"QR payee differs from registered payee for shop {nearest_merchant.shop_code}",
                f"Scan is {int(min_distance)} m from the shop",
            ]
            if session is not None and trigger_alert:
                record_merchant_alert(
                    session=session,
                    merchant=nearest_merchant,
                    scanned_upi=upi_id,
                    scan_id=scan_id,
                    alert_type="qr_swap",
                    extra_details={"distance_m": round(min_distance, 1)},
                )

            return Signal.danger(
                detector="registry_binding",
                score=0.95,
                evidence=evidence,
                explanation_key="payee_not_registered_here",
            )

        # Nearest merchant is further than radius_m
        return Signal.ok(
            detector="registry_binding",
            evidence=["no registry data"],
            explanation_key="no_registry_data",
        )

    # Case C: No GPS and no shop code
    return Signal.ok(
        detector="registry_binding",
        evidence=["no registry data"],
        explanation_key="no_registry_data",
    )
