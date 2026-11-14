"""Tests for merchant registration and alert endpoints (SPEC Section 4.4, Step 3).

Verifies:
  - POST /api/merchant/register:
      - Valid registration creates merchant and returns 201 Created.
      - GPS coordinates are rounded to 3 decimal places (~111 m).
      - Duplicate shop code raises 400 Bad Request.
      - Auto-generation of shop code when omitted.
  - GET /api/merchant/{id}/alerts:
      - Returns alerts by merchant integer ID.
      - Returns alerts by merchant shop code (e.g. KIR-0001).
      - Returns 404 for non-existent merchant.
      - Empty list when no alerts exist.
  - Integration with simulate_scans script helpers.
"""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine

from app.database import get_session
from app.main import app
from app.models import Alert, Merchant
from scripts.simulate_scans import simulate_crowd_drift, simulate_swap_burst


@pytest.fixture(name="engine")
def fixture_engine(tmp_path: Path):
    """Create a temporary SQLite engine."""
    db_file = tmp_path / "test_api_merchant.db"
    engine = create_engine(f"sqlite:///{db_file}", echo=False)
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture(name="session")
def fixture_session(engine):
    """Yield a database session."""
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def fixture_client(engine):
    """TestClient configured with test database session override."""
    def _override_session():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = _override_session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


class TestMerchantRegisterAPI:
    """Test POST /api/merchant/register."""

    def test_register_merchant_success(self, client: TestClient) -> None:
        """Registering a valid merchant returns 201 with 3-decimal coordinates."""
        payload = {
            "name": "Lakshmi Kirana",
            "upi_id": "lakshmi.kirana@okaxis",
            "lat": 17.385412,
            "lng": 78.486789,
            "shop_code": "KIR-9001",
            "category": "grocery",
        }
        resp = client.post("/api/merchant/register", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["shop_code"] == "KIR-9001"
        assert data["name"] == "Lakshmi Kirana"
        assert data["upi_id"] == "lakshmi.kirana@okaxis"
        assert data["coarse_lat"] == 17.385
        assert data["coarse_lng"] == 78.487

    def test_register_duplicate_shop_code_fails(self, client: TestClient) -> None:
        """Attempting to register an already existing shop code returns 400."""
        payload = {
            "name": "First Shop",
            "upi_id": "first@okaxis",
            "lat": 17.385,
            "lng": 78.487,
            "shop_code": "KIR-DUP01",
        }
        resp1 = client.post("/api/merchant/register", json=payload)
        assert resp1.status_code == 201

        resp2 = client.post("/api/merchant/register", json=payload)
        assert resp2.status_code == 400
        assert "already registered" in resp2.json()["detail"]

    def test_register_omitted_shop_code_auto_generates(self, client: TestClient) -> None:
        """If shop_code is omitted, the backend auto-generates a KIR-XXXX code."""
        payload = {
            "name": "Auto Shop",
            "upi_id": "auto@okaxis",
            "lat": 17.390,
            "lng": 78.490,
        }
        resp = client.post("/api/merchant/register", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["shop_code"].startswith("KIR-")


class TestMerchantAlertsAPI:
    """Test GET /api/merchant/{id}/alerts."""

    def test_get_alerts_by_shop_code_empty(self, client: TestClient) -> None:
        """Registered merchant with no alerts returns empty list."""
        reg = client.post("/api/merchant/register", json={
            "name": "Clean Shop",
            "upi_id": "clean@okaxis",
            "lat": 17.385,
            "lng": 78.487,
            "shop_code": "KIR-CLEAN",
        })
        assert reg.status_code == 201

        resp = client.get("/api/merchant/KIR-CLEAN/alerts")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_get_alerts_by_numeric_id_and_code(
        self, client: TestClient, session: Session
    ) -> None:
        """Alerts are retrievable by both numeric merchant ID and shop code string."""
        m = Merchant(
            shop_code="KIR-ALERTED",
            name="Target Shop",
            upi_id="target@okaxis",
            coarse_lat=17.385,
            coarse_lng=78.487,
            is_active=True,
        )
        session.add(m)
        session.commit()
        session.refresh(m)

        alert = Alert(
            merchant_id=m.id,
            type="qr_swap",
            risk_level="danger",
            count=3,
            seen=False,
            details_json='{"scanned_upi": "scammer@ybl"}',
            explanation_key="payee_not_registered_here",
        )
        session.add(alert)
        session.commit()

        # Query by numeric ID
        resp_by_id = client.get(f"/api/merchant/{m.id}/alerts")
        assert resp_by_id.status_code == 200
        data_id = resp_by_id.json()
        assert len(data_id) == 1
        assert data_id[0]["count"] == 3
        assert data_id[0]["type"] == "qr_swap"

        # Query by shop code
        resp_by_code = client.get("/api/merchant/KIR-ALERTED/alerts")
        assert resp_by_code.status_code == 200
        data_code = resp_by_code.json()
        assert len(data_code) == 1
        assert data_code[0]["id"] == alert.id

    def test_get_alerts_merchant_not_found(self, client: TestClient) -> None:
        """Non-existent merchant returns 404."""
        resp = client.get("/api/merchant/NONEXISTENT-CODE/alerts")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()


class TestSimulateScansIntegration:
    """Test the simulate_scans script helpers directly."""

    def test_simulate_swap_burst_creates_alert(self, session: Session) -> None:
        """simulate_swap_burst creates 1 alert with count = burst count."""
        m = Merchant(
            shop_code="KIR-SIM01",
            name="Simulated Shop",
            upi_id="sim@okaxis",
            coarse_lat=17.385,
            coarse_lng=78.487,
            is_active=True,
        )
        session.add(m)
        session.commit()

        alert = simulate_swap_burst(
            session=session,
            shop_code="KIR-SIM01",
            fake_upi="fake@ybl",
            burst_count=4,
        )
        assert alert.count == 4
        assert alert.merchant_id == m.id
        assert alert.type == "qr_swap"

    def test_simulate_crowd_drift(self, session: Session) -> None:
        """simulate_crowd_drift sets up history and records a drifted scan."""
        history, new_scan = simulate_crowd_drift(
            session=session,
            coarse_lat=17.410,
            coarse_lng=78.510,
            dominant_upi="vendor@okaxis",
            new_upi="new_vendor@ybl",
            history_count=9,
        )
        assert len(history) == 9
        assert new_scan.upi_id == "new_vendor@ybl"
