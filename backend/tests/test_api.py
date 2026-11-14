"""End-to-end API tests for check endpoints (SPEC Sections 4.4 and 7).

Tests:
  - POST /api/check/qr
  - POST /api/check/text
  - POST /api/check/image
  - Standard response shape: request_id, verdict, reasons, explanation, next_steps, latency_ms.
  - Multi-detector integration, database persistence, and fusion hierarchy.
"""

from pathlib import Path
from unittest.mock import patch

import cv2
from fastapi.testclient import TestClient
import numpy as np
from PIL import Image, ImageDraw
import pytest
from sqlmodel import Session, SQLModel, create_engine, select

from app.database import get_session
from app.main import app
from app.models import Alert, FlaggedPayee, Merchant, Message, Scan


# ---------------------------------------------------------------------------
# Fixtures & Helpers
# ---------------------------------------------------------------------------

@pytest.fixture(name="engine")
def fixture_engine(tmp_path: Path):
    """Create a temporary SQLite engine."""
    db_file = tmp_path / "test_api_check.db"
    engine = create_engine(f"sqlite:///{db_file}", echo=False)
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture(name="session")
def fixture_session(engine):
    """Yield a database session bound to the temporary engine."""
    with Session(engine) as s:
        yield s


@pytest.fixture(name="client")
def fixture_client(engine):
    """TestClient configured with database session dependency override."""
    def _override_session():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = _override_session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(name="registered_merchant")
def fixture_registered_merchant(session: Session) -> Merchant:
    """Insert a registered merchant at Charminar coordinates."""
    m = Merchant(
        shop_code="KIR-0001",
        name="Charminar Kirana",
        upi_id="charminar.kirana@okaxis",
        coarse_lat=17.385,
        coarse_lng=78.487,
        is_active=True,
    )
    session.add(m)
    session.commit()
    session.refresh(m)
    return m


def _make_qr_image_bytes(payload: str) -> bytes:
    """Generate a clean QR code image in PNG bytes."""
    enc = cv2.QRCodeEncoder.create()
    matrix = enc.encode(payload)
    scaled = cv2.resize(matrix, (300, 300), interpolation=cv2.INTER_NEAREST)
    padded = cv2.copyMakeBorder(scaled, 40, 40, 40, 40, cv2.BORDER_CONSTANT, value=255)
    success, buf = cv2.imencode(".png", padded)
    assert success
    return buf.tobytes()


# ---------------------------------------------------------------------------
# 1. POST /api/check/qr Tests
# ---------------------------------------------------------------------------

class TestCheckQRAPI:
    """Verify POST /api/check/qr across all scenarios."""

    def test_qr_verified_at_registered_shop(
        self, client: TestClient, registered_merchant: Merchant
    ) -> None:
        """Genuine QR scanned near registered shop -> VERIFIED."""
        payload = {
            "payload": "upi://pay?pa=charminar.kirana@okaxis&pn=CharminarStore&am=50.00",
            "lat": 17.38505,
            "lng": 78.48705,
        }
        resp = client.post("/api/check/qr", json=payload)
        assert resp.status_code == 200
        data = resp.json()

        assert data["verdict"] == "VERIFIED"
        assert data["reasons"] == []
        assert "verified" in data["explanation"]["en"].lower()
        assert data["explanation"]["te"] is not None
        assert data["explanation"]["hi"] is not None
        assert len(data["next_steps"]) > 0
        assert data["latency_ms"] >= 0
        assert data["request_id"].startswith("r_")

    def test_qr_danger_on_swapped_payee(
        self, client: TestClient, registered_merchant: Merchant, session: Session
    ) -> None:
        """Fraudulent QR scanned near registered shop -> DANGER and alert created."""
        payload = {
            "payload": "upi://pay?pa=fraudster@ybl&pn=FakeStore",
            "lat": 17.38505,
            "lng": 78.48705,
        }
        resp = client.post("/api/check/qr", json=payload)
        assert resp.status_code == 200
        data = resp.json()

        assert data["verdict"] == "DANGER"
        assert len(data["reasons"]) >= 1
        assert any(r["detector"] == "registry_binding" for r in data["reasons"])
        assert "differs" in data["explanation"]["en"]

        # Verify alert created in DB
        alerts = session.exec(
            select(Alert).where(Alert.merchant_id == registered_merchant.id)
        ).all()
        assert len(alerts) == 1
        assert alerts[0].type == "qr_swap"

    def test_qr_danger_on_lookalike_handle(self, client: TestClient) -> None:
        """Lookalike brand + support handle -> DANGER."""
        payload = {
            "payload": "upi://pay?pa=sbi.support@oksbi&pn=SBISupport",
        }
        resp = client.post("/api/check/qr", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["verdict"] == "DANGER"
        assert any(r["detector"] == "handle_lookalike" for r in data["reasons"])

    def test_qr_unverified_at_unregistered_location(self, client: TestClient) -> None:
        """Legitimate handle scanned far from any registered shop -> UNVERIFIED."""
        payload = {
            "payload": "upi://pay?pa=corner.tea@okaxis&pn=TeaStall",
            "lat": 17.500,
            "lng": 78.600,
        }
        resp = client.post("/api/check/qr", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["verdict"] == "UNVERIFIED"

    def test_qr_invalid_missing_payee(self, client: TestClient) -> None:
        """Missing 'pa' parameter in QR -> DANGER."""
        payload = {
            "payload": "upi://pay?pn=NoPayeeStore&am=100",
        }
        resp = client.post("/api/check/qr", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["verdict"] == "DANGER"
        assert any(r["detector"] == "qr_parser" for r in data["reasons"])

    def test_qr_persists_scan_event(
        self, client: TestClient, session: Session
    ) -> None:
        """Every check/qr call records coarse coordinates in the scans table."""
        payload = {
            "payload": "upi://pay?pa=test.shop@okaxis",
            "lat": 17.385432,
            "lng": 78.487654,
        }
        resp = client.post("/api/check/qr", json=payload)
        assert resp.status_code == 200

        scans = session.exec(select(Scan)).all()
        assert len(scans) == 1
        assert scans[0].coarse_lat == 17.385  # Rounded to 3 decimals
        assert scans[0].coarse_lng == 78.488


# ---------------------------------------------------------------------------
# 2. POST /api/check/text Tests
# ---------------------------------------------------------------------------

class TestCheckTextAPI:
    """Verify POST /api/check/text."""

    def test_scam_message_returns_danger(
        self, client: TestClient, session: Session
    ) -> None:
        """Digital arrest scam message -> DANGER."""
        msg_text = (
            "This is CBI. You are under digital arrest. "
            "Transfer Rs 50,000 to verify your account to cbi.verify@ybl immediately."
        )
        resp = client.post("/api/check/text", json={"text": msg_text})
        assert resp.status_code == 200
        data = resp.json()

        assert data["verdict"] == "DANGER"
        assert len(data["reasons"]) >= 1
        assert "scam" in data["explanation"]["en"].lower()

        # Verify extracted payee persisted in flagged_payees
        flagged = session.exec(
            select(FlaggedPayee).where(FlaggedPayee.upi_id == "cbi.verify@ybl")
        ).first()
        assert flagged is not None
        assert flagged.score >= 0.80

        # Verify message saved in messages table
        messages = session.exec(select(Message)).all()
        assert len(messages) == 1
        assert messages[0].score is not None

    def test_safe_message_returns_unverified_with_specific_text(
        self, client: TestClient
    ) -> None:
        """Harmless family text -> UNVERIFIED with 'No scam signs found. This is not a guarantee.'"""
        msg_text = "Amma, I reached home safely. Will call you later in the evening."
        resp = client.post("/api/check/text", json={"text": msg_text})
        assert resp.status_code == 200
        data = resp.json()

        assert data["verdict"] == "UNVERIFIED"
        assert data["reasons"] == []
        assert "No scam signs found. This is not a guarantee." in data["explanation"]["en"]


# ---------------------------------------------------------------------------
# 3. POST /api/check/image Tests
# ---------------------------------------------------------------------------

class TestCheckImageAPI:
    """Verify POST /api/check/image."""

    def test_image_with_qr_code_decoded_and_checked(
        self, client: TestClient, registered_merchant: Merchant
    ) -> None:
        """Uploading an image with a QR code decodes and performs QR check."""
        qr_bytes = _make_qr_image_bytes(
            f"upi://pay?pa={registered_merchant.upi_id}&pn=CharminarStore"
        )
        files = {"file": ("qr_sample.png", qr_bytes, "image/png")}
        data_fields = {
            "lat": str(registered_merchant.coarse_lat),
            "lng": str(registered_merchant.coarse_lng),
        }
        resp = client.post("/api/check/image", files=files, data=data_fields)
        assert resp.status_code == 200
        data = resp.json()

        assert data["verdict"] == "VERIFIED"
        assert "verified" in data["explanation"]["en"].lower()
        assert data["latency_ms"] >= 0

    def test_blank_image_returns_caution_prompt(self, client: TestClient) -> None:
        """Uploading a blank image returns CAUTION asking user to paste text."""
        blank_img = np.full((150, 150, 3), 255, dtype=np.uint8)
        _, buf = cv2.imencode(".png", blank_img)
        files = {"file": ("blank.png", buf.tobytes(), "image/png")}

        resp = client.post("/api/check/image", files=files)
        assert resp.status_code == 200
        data = resp.json()

        assert data["verdict"] == "CAUTION"
        assert any(r["detector"] == "ocr" for r in data["reasons"])
        assert "paste" in data["explanation"]["en"].lower()

    def test_screenshot_with_scam_text_ocr(self, client: TestClient) -> None:
        """Uploading a screenshot with scam text extracts via OCR and scores."""
        # Create image with text
        img = Image.new("RGB", (300, 80), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)
        draw.text((10, 20), "Your KYC expires today. Install KYC_Update.apk", fill=(0, 0, 0))
        img_buf = io = Path("temp_img.png")
        img.save(img_buf, format="PNG")
        with open(img_buf, "rb") as f:
            img_bytes = f.read()
        if img_buf.exists():
            img_buf.unlink()

        mock_ocr = {
            "type": "text",
            "text": "Your KYC expires today. Install KYC_Update.apk",
            "confidence": 92.0,
            "error": None,
        }
        with patch("app.detectors.ocr.process_image", return_value=mock_ocr):
            files = {"file": ("screenshot.png", img_bytes, "image/png")}
            resp = client.post("/api/check/image", files=files)
            assert resp.status_code == 200
            data = resp.json()
            assert data["verdict"] == "DANGER"
            assert "scam" in data["explanation"]["en"].lower()


class TestDemoSimulateAPI:
    """Verify POST /api/demo/simulate (SPEC 8.1 & Section 11)."""

    def test_demo_simulate_qr_swap(
        self, client: TestClient, registered_merchant: Merchant
    ) -> None:
        """qr_swap triggers a swap scan, danger verdict, and merchant alert."""
        resp = client.post("/api/demo/simulate", json={"action": "qr_swap", "shop_code": registered_merchant.shop_code})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert data["action"] == "qr_swap"
        assert data["verdict"] == "DANGER"
        assert data["shop_code"] == registered_merchant.shop_code

    def test_demo_simulate_drift(self, client: TestClient) -> None:
        """drift establishes baseline and triggers caution verdict on changed payee."""
        resp = client.post("/api/demo/simulate", json={"action": "drift"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert data["action"] == "drift"
        assert data["verdict"] == "CAUTION"

    def test_demo_simulate_scam_with_payee(self, client: TestClient) -> None:
        """scam_with_payee submits scam text and flags the payee."""
        resp = client.post("/api/demo/simulate", json={"action": "scam_with_payee"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert data["action"] == "scam_with_payee"
        assert data["verdict"] == "DANGER"
        assert "officer.cbi.investigation@okaxis" in data["flagged_upi"]

    def test_demo_simulate_reset(self, client: TestClient, session: Session) -> None:
        """reset cleans tables and re-seeds merchants."""
        resp = client.post("/api/demo/simulate", json={"action": "reset"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert data["action"] == "reset"
        assert data["merchants_count"] == 20

    def test_demo_simulate_invalid_action(self, client: TestClient) -> None:
        """Unknown action returns 400 Bad Request."""
        resp = client.post("/api/demo/simulate", json={"action": "unknown_action"})
        assert resp.status_code == 400


class TestMetricsAPI:
    """Verify GET /api/metrics (SPEC 8.1 & Section 11)."""

    def test_get_metrics(self, client: TestClient) -> None:
        resp = client.get("/api/metrics")
        assert resp.status_code == 200
        data = resp.json()
        assert data["scan_scenarios_accuracy"] == 1.0
        assert data["held_out_accuracy"] == 0.95
        assert data["held_out_precision"] == 1.0
        assert data["held_out_recall"] == 0.90
        assert data["held_out_fpr"] == 0.0
        assert "median_latency_ms" in data
        assert "p95_latency_ms" in data
        assert "total_merchants" in data
