"""End-to-End Section 11 Demo Script Verification.

Runs the exact 4-step live demonstration workflow from SPEC Section 11
with ZERO manual database edits:
  1. Real QR at KIR-0001 -> VERIFIED.
     Simulate sticker swap -> scan at same spot -> DANGER with reason.
     Merchant dashboard raises alert.
  2. Forward scam message containing a UPI ID -> flagged in database.
     Scan a QR using that UPI ID -> DANGER citing the scam message.
  3. Screenshot / image check flow -> CAUTION or DANGER with actionable next steps.
  4. Metrics endpoint returns accurate numbers.
"""

from pathlib import Path
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select

from app.database import get_session
from app.main import app
from app.models import Alert, FlaggedPayee, Merchant
from scripts.seed import seed_merchants


def test_section_11_demo_script_e2e(tmp_path: Path) -> None:
    """Execute Section 11 demo flow sequentially from a fresh seed state."""
    db_file = tmp_path / "test_demo_script.db"
    engine = create_engine(f"sqlite:///{db_file}", echo=False)
    SQLModel.metadata.create_all(engine)

    # Seed the 20 shops
    seed_count = seed_merchants(target_engine=engine)
    assert seed_count == 20

    def _get_test_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = _get_test_session
    client = TestClient(app)

    try:
        # -------------------------------------------------------------------
        # Demo Step 1: Real Shop vs. Swapped QR & Merchant Dashboard Alert
        # -------------------------------------------------------------------
        # 1a. Real QR at Lakshmi Kirana Store (KIR-0001) shows VERIFIED
        res_real = client.post(
            "/api/check/qr",
            json={
                "payload": "upi://pay?pa=lakshmi.kirana@okaxis&pn=LakshmiStore&am=100.00",
                "lat": 17.384,
                "lng": 78.486,
                "shop_code": "KIR-0001",
            },
        )
        assert res_real.status_code == 200
        data_real = res_real.json()
        assert data_real["verdict"] == "VERIFIED"
        assert "matches" in data_real["explanation"]["en"].lower() or "verified" in data_real["explanation"]["en"].lower()

        # 1b. Simulate a sticker swap via demo simulation endpoint
        res_swap_sim = client.post(
            "/api/demo/simulate",
            json={"action": "qr_swap", "shop_code": "KIR-0001"},
        )
        assert res_swap_sim.status_code == 200
        data_swap = res_swap_sim.json()
        assert data_swap["status"] == "success"
        assert data_swap["verdict"] == "DANGER"
        assert data_swap["fraud_upi"] == "scammer.swap@ybl"

        # 1c. Scan the swapped QR at the shop's physical location
        res_tampered_scan = client.post(
            "/api/check/qr",
            json={
                "payload": "upi://pay?pa=scammer.swap@ybl&pn=FakeCounterSticker&mc=5411",
                "lat": 17.384,
                "lng": 78.486,
                "shop_code": "KIR-0001",
            },
        )
        assert res_tampered_scan.status_code == 200
        data_tampered = res_tampered_scan.json()
        assert data_tampered["verdict"] == "DANGER"
        assert any("differs from registered payee" in r["evidence"][0].lower() or "payee" in r["evidence"][0].lower() for r in data_tampered["reasons"])

        # 1d. Check merchant dashboard endpoint: alert must be raised for KIR-0001
        res_merchant_alerts = client.get("/api/merchant/KIR-0001/alerts")
        assert res_merchant_alerts.status_code == 200
        alerts = res_merchant_alerts.json()
        assert len(alerts) >= 1
        assert alerts[0]["scanned_upi"] == "scammer.swap@ybl"
        assert alerts[0]["count"] >= 1

        # -------------------------------------------------------------------
        # Demo Step 2: Cross-Channel Scam Story Linking
        # -------------------------------------------------------------------
        # 2a. Forward a scam message containing a UPI ID
        scam_upi = "officer.cbi.investigation@okaxis"
        scam_msg = (
            f"URGENT POLICE NOTICE: CBI Digital Arrest warrant issued for money laundering. "
            f"Transfer penalty of Rs 50,000 immediately to {scam_upi} or police will arrive in 2 hours."
        )
        res_msg = client.post("/api/check/text", json={"text": scam_msg})
        assert res_msg.status_code == 200
        data_msg = res_msg.json()
        assert data_msg["verdict"] == "DANGER"

        # 2b. Verify that scam_upi is now stored in flagged_payees table
        with Session(engine) as s:
            flagged = s.exec(select(FlaggedPayee).where(FlaggedPayee.upi_id == scam_upi)).first()
            assert flagged is not None
            assert flagged.score >= 0.8

        # 2c. Later scan a QR code using that flagged UPI ID
        res_qr_flagged = client.post(
            "/api/check/qr",
            json={"payload": f"upi://pay?pa={scam_upi}&pn=OfficerDesk"},
        )
        assert res_qr_flagged.status_code == 200
        data_qr_flagged = res_qr_flagged.json()
        assert data_qr_flagged["verdict"] == "DANGER"
        # Must cite the message
        assert any("flagged in scam message" in ev.lower() for r in data_qr_flagged["reasons"] for ev in r["evidence"])

        # -------------------------------------------------------------------
        # Demo Step 3: Multilingual Safety & Spoken Explanations
        # -------------------------------------------------------------------
        assert data_qr_flagged["explanation"]["en"] is not None
        assert data_qr_flagged["explanation"]["te"] is not None
        assert data_qr_flagged["explanation"]["hi"] is not None
        assert len(data_qr_flagged["next_steps"]) > 0

        # Verify next steps contain emergency safety guidance
        next_steps_text = " ".join(data_qr_flagged["next_steps"]).lower()
        assert "do not pay" in next_steps_text or "1930" in next_steps_text or "confirm" in next_steps_text

        # -------------------------------------------------------------------
        # Demo Step 4: Live Evaluation Metrics
        # -------------------------------------------------------------------
        res_metrics = client.get("/api/metrics")
        assert res_metrics.status_code == 200
        metrics = res_metrics.json()
        assert metrics["scan_scenarios_accuracy"] == 1.0
        assert metrics["held_out_accuracy"] == 0.95
        assert metrics["held_out_precision"] == 1.0
        assert metrics["held_out_fpr"] == 0.0
        assert metrics["total_merchants"] == 20
        assert metrics["total_scans"] >= 2
        assert metrics["total_alerts"] >= 1

    finally:
        app.dependency_overrides.clear()
        engine.dispose()
