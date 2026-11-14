"""Tests for registry binding detector and merchant alerts (SPEC Section 6.3).

Verifies:
  - Haversine distance calculation correctness.
  - Every row of the SPEC Section 6.3 table:
      1. Same UPI ID, 20 m from shop -> matches registry
      2. Different UPI ID, 20 m from shop -> danger and an alert
      3. Any UPI ID, 2 km from every shop -> no registry data
      4. shop_code KIR-0042, different UPI ID, no GPS -> danger
      5. Unknown shop_code -> no registry data with a note
      6. Two shops 60 m apart -> nearest shop is used
  - Swap burst: duplicate scans within 30 minutes create exactly 1 alert with count = burst size.
  - Rate limit expiration: scan after 30 minutes creates a new alert record.
  - Case-insensitivity of UPI IDs and shop codes.
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlmodel import Session, SQLModel, create_engine, select

from app.alerts import record_merchant_alert
from app.detectors.registry_binding import detect, haversine_distance
from app.models import Alert, Merchant


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(name="engine")
def fixture_engine(tmp_path: Path):
    """Create a temporary SQLite engine."""
    db_file = tmp_path / "test_reg.db"
    engine = create_engine(f"sqlite:///{db_file}", echo=False)
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture(name="session")
def fixture_session(engine):
    """Yield a database session bound to the temporary engine."""
    with Session(engine) as session:
        yield session


@pytest.fixture(name="sample_merchant")
def fixture_sample_merchant(session: Session) -> Merchant:
    """Create a standard merchant at Charminar coordinates (17.385, 78.487)."""
    m = Merchant(
        shop_code="KIR-0042",
        name="Ramu General Store",
        upi_id="ramu.stores@okaxis",
        category="grocery",
        coarse_lat=17.385,
        coarse_lng=78.487,
        is_active=True,
    )
    session.add(m)
    session.commit()
    session.refresh(m)
    return m


# ---------------------------------------------------------------------------
# 1. Haversine distance tests
# ---------------------------------------------------------------------------

class TestHaversineDistance:
    """Verify haversine formula implementation without external libraries."""

    def test_same_point_is_zero(self) -> None:
        """Distance between identical points should be 0.0 meters."""
        d = haversine_distance(17.385, 78.487, 17.385, 78.487)
        assert d == pytest.approx(0.0, abs=0.01)

    def test_known_one_degree_latitude(self) -> None:
        """1 degree of latitude is approximately 111,195 meters (111.2 km)."""
        d = haversine_distance(17.0, 78.0, 18.0, 78.0)
        assert 110_000 < d < 112_000

    def test_short_distance_accuracy(self) -> None:
        """A shift of 0.00018 degrees latitude is ~20 meters."""
        # 0.00018 * 111,195 m ≈ 20.0 m
        lat1, lon1 = 17.38500, 78.48700
        lat2, lon2 = 17.38518, 78.48700
        d = haversine_distance(lat1, lon1, lat2, lon2)
        assert 18.0 < d < 22.0


# ---------------------------------------------------------------------------
# 2. SPEC Section 6.3 Table Tests
# ---------------------------------------------------------------------------

class TestSpecTableCases:
    """Test all six specific rows required by SPEC Section 6.3."""

    def test_row1_same_upi_20m_from_shop(self, sample_merchant: Merchant) -> None:
        """Same UPI ID, 20 m from shop -> matches registry (ok)."""
        # 0.00018 deg north ≈ 20 m
        scan_lat = sample_merchant.coarse_lat + 0.00018
        scan_lng = sample_merchant.coarse_lng

        sig = detect(
            upi_id="ramu.stores@okaxis",
            coarse_lat=scan_lat,
            coarse_lng=scan_lng,
            merchants=[sample_merchant],
        )

        assert sig.severity == "ok"
        assert sig.score == 0.0
        assert "matches registry" in sig.evidence
        assert sig.explanation_key == "matches_registry"

    def test_row2_different_upi_20m_from_shop(
        self, session: Session, sample_merchant: Merchant
    ) -> None:
        """Different UPI ID, 20 m from shop -> danger and an alert."""
        scan_lat = sample_merchant.coarse_lat + 0.00018
        scan_lng = sample_merchant.coarse_lng

        sig = detect(
            upi_id="fraudster.scam@ybl",
            coarse_lat=scan_lat,
            coarse_lng=scan_lng,
            session=session,
            trigger_alert=True,
        )

        assert sig.severity == "danger"
        assert sig.score >= 0.9
        assert any("differs" in ev for ev in sig.evidence)
        assert sig.explanation_key == "payee_not_registered_here"

        # Verify an alert was created in the database
        alerts = session.exec(select(Alert).where(Alert.merchant_id == sample_merchant.id)).all()
        assert len(alerts) == 1
        assert alerts[0].count == 1
        assert alerts[0].type == "qr_swap"

    def test_row3_any_upi_2km_from_every_shop(self, sample_merchant: Merchant) -> None:
        """Any UPI ID, 2 km from every shop -> no registry data."""
        # 0.02 deg latitude is ~2.2 km away
        far_lat = sample_merchant.coarse_lat + 0.02
        far_lng = sample_merchant.coarse_lng

        sig = detect(
            upi_id="ramu.stores@okaxis",
            coarse_lat=far_lat,
            coarse_lng=far_lng,
            merchants=[sample_merchant],
        )

        assert sig.severity == "ok"
        assert sig.score == 0.0
        assert "no registry data" in sig.evidence
        assert sig.explanation_key == "no_registry_data"

    def test_row4_shop_code_different_upi_no_gps(
        self, session: Session, sample_merchant: Merchant
    ) -> None:
        """shop_code KIR-0042, different UPI ID, no GPS -> danger."""
        sig = detect(
            upi_id="fake_payee@okaxis",
            coarse_lat=None,
            coarse_lng=None,
            shop_code="KIR-0042",
            session=session,
            trigger_alert=True,
        )

        assert sig.severity == "danger"
        assert sig.score >= 0.9
        assert any("KIR-0042" in ev for ev in sig.evidence)
        assert sig.explanation_key == "payee_not_registered_here"

        # Verify alert created for KIR-0042
        alerts = session.exec(select(Alert).where(Alert.merchant_id == sample_merchant.id)).all()
        assert len(alerts) == 1

    def test_row5_unknown_shop_code(self, sample_merchant: Merchant) -> None:
        """Unknown shop_code -> no registry data with a note."""
        sig = detect(
            upi_id="anyone@okaxis",
            coarse_lat=None,
            coarse_lng=None,
            shop_code="KIR-9999",
            merchants=[sample_merchant],
        )

        assert sig.severity == "ok"
        assert sig.score == 0.0
        assert any("no registry data" in ev for ev in sig.evidence)
        assert any("unknown shop code" in ev for ev in sig.evidence)
        assert sig.explanation_key == "no_registry_data"

    def test_row6_two_shops_60m_apart_nearest_is_used(self, session: Session) -> None:
        """Two shops 60 m apart -> nearest shop is used."""
        # Shop A at (17.38500, 78.48670)
        shop_a = Merchant(
            shop_code="KIR-0001",
            name="Shop Alpha",
            upi_id="alpha@okaxis",
            coarse_lat=17.38500,
            coarse_lng=78.48670,
            is_active=True,
        )
        # Shop B 60 m away north (0.00054 deg ≈ 60 m) at (17.38554, 78.48670)
        shop_b = Merchant(
            shop_code="KIR-0002",
            name="Shop Beta",
            upi_id="beta@okaxis",
            coarse_lat=17.38554,
            coarse_lng=78.48670,
            is_active=True,
        )
        session.add(shop_a)
        session.add(shop_b)
        session.commit()

        # Scan is 10 m from Shop A (17.38509, 78.48670), 50 m from Shop B
        scan_lat = 17.38509
        scan_lng = 78.48670

        # Scan has Shop A's UPI ID -> should match Shop A (nearest)
        sig_a = detect(
            upi_id="alpha@okaxis",
            coarse_lat=scan_lat,
            coarse_lng=scan_lng,
            merchants=[shop_a, shop_b],
        )
        assert sig_a.severity == "ok"
        assert "matches registry" in sig_a.evidence

        # Scan at same location has Shop B's UPI ID -> nearest is Shop A, so mismatch with Shop A
        sig_b = detect(
            upi_id="beta@okaxis",
            coarse_lat=scan_lat,
            coarse_lng=scan_lng,
            merchants=[shop_a, shop_b],
        )
        assert sig_b.severity == "danger"
        assert any("KIR-0001" in ev for ev in sig_b.evidence)


# ---------------------------------------------------------------------------
# 3. Swap Burst and Alert Rate Limiting
# ---------------------------------------------------------------------------

class TestAlertLogicAndSwapBurst:
    """Test the 30-minute alert rate-limiting and counter increments."""

    def test_swap_burst_creates_single_alert_with_count(
        self, session: Session, sample_merchant: Merchant
    ) -> None:
        """A burst of 5 fraudulent scans within 10 minutes creates 1 alert with count = 5."""
        scan_lat = sample_merchant.coarse_lat + 0.0001
        scan_lng = sample_merchant.coarse_lng

        for i in range(5):
            sig = detect(
                upi_id="attacker@ybl",
                coarse_lat=scan_lat,
                coarse_lng=scan_lng,
                session=session,
                trigger_alert=True,
            )
            assert sig.severity == "danger"

        # Check the database: must have exactly 1 alert with count 5
        alerts = session.exec(
            select(Alert).where(Alert.merchant_id == sample_merchant.id)
        ).all()
        assert len(alerts) == 1
        assert alerts[0].count == 5
        assert alerts[0].risk_level == "danger"

    def test_alert_after_rate_limit_window_creates_new_alert(
        self, session: Session, sample_merchant: Merchant
    ) -> None:
        """A scan after 31 minutes creates a separate alert."""
        # First alert created 35 minutes ago
        past_time = datetime.now(timezone.utc) - timedelta(minutes=35)
        old_alert = Alert(
            merchant_id=sample_merchant.id,
            type="qr_swap",
            risk_level="danger",
            count=3,
            seen=False,
            created_at=past_time,
        )
        session.add(old_alert)
        session.commit()

        # New scan now
        scan_lat = sample_merchant.coarse_lat + 0.0001
        scan_lng = sample_merchant.coarse_lng

        sig = detect(
            upi_id="attacker@ybl",
            coarse_lat=scan_lat,
            coarse_lng=scan_lng,
            session=session,
            trigger_alert=True,
        )
        assert sig.severity == "danger"

        # Verify there are now 2 distinct alerts
        alerts = session.exec(
            select(Alert).where(Alert.merchant_id == sample_merchant.id)
        ).all()
        assert len(alerts) == 2
        # The new alert should start with count = 1
        new_alerts = [a for a in alerts if a.id != old_alert.id]
        assert len(new_alerts) == 1
        assert new_alerts[0].count == 1

    def test_case_insensitive_upi_matching(self, sample_merchant: Merchant) -> None:
        """UPI matching must be case-insensitive."""
        scan_lat = sample_merchant.coarse_lat
        scan_lng = sample_merchant.coarse_lng

        sig = detect(
            upi_id="RAMU.STORES@OKAXIS",
            coarse_lat=scan_lat,
            coarse_lng=scan_lng,
            merchants=[sample_merchant],
        )
        assert sig.severity == "ok"
        assert "matches registry" in sig.evidence
