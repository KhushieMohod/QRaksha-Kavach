"""Tests for static APK metadata triage detector (SPEC Section 6.8 & AGENTS.md Rule 10)."""

import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine

from app.database import get_session
from app.detectors import apk_triage
from app.main import app

DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "apk_samples.json"


@pytest.fixture(name="client")
def fixture_client():
    engine = create_engine("sqlite:///:memory:", echo=False)
    SQLModel.metadata.create_all(engine)

    def _get_test_session():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = _get_test_session
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


class TestAPKSamplesJson:
    """Verify all 6 samples in data/apk_samples.json match expected verdicts."""

    def test_samples_file_exists_and_has_six_samples(self) -> None:
        assert DATA_FILE.exists(), "data/apk_samples.json must exist"
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            samples = json.load(f)

        assert len(samples) == 6
        harmless = [s for s in samples if s["expected_verdict"] == "ok"]
        lures = [s for s in samples if s["expected_verdict"] == "danger"]
        assert len(harmless) == 3, "Must have exactly 3 harmless samples"
        assert len(lures) == 3, "Must have exactly 3 lure samples"

    def test_all_samples_evaluate_to_expected_verdicts(self) -> None:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            samples = json.load(f)

        for s in samples:
            meta = apk_triage.APKMetadata(
                file_name=s["file_name"],
                permissions=s["permissions"],
                source=s["source"],
            )
            sig = apk_triage.detect(meta)
            assert sig.detector == "apk_triage"
            assert sig.severity == s["expected_verdict"], (
                f"Sample {s['id']} ({s['file_name']}) expected {s['expected_verdict']} but got {sig.severity}"
            )


class TestAPKTriageDetectorLogic:
    """Detailed unit tests for rules, weights, and security constraints."""

    def test_challan_lure_with_sms_permissions_returns_danger(self) -> None:
        meta = {
            "file_name": "Traffic_Challan_2026.apk",
            "permissions": ["READ_SMS", "RECEIVE_SMS"],
            "source": "whatsapp_download",
        }
        sig = apk_triage.detect(meta)
        assert sig.severity == "danger"
        assert sig.score >= 0.8
        assert any("challan" in ev.lower() for ev in sig.evidence)
        assert any("sms" in ev.lower() for ev in sig.evidence)

    def test_accessibility_service_from_untrusted_source_returns_danger(self) -> None:
        meta = {
            "file_name": "Kisan_Yojana_Registration.apk",
            "permissions": ["android.permission.BIND_ACCESSIBILITY_SERVICE"],
            "source": "telegram",
        }
        sig = apk_triage.detect(meta)
        assert sig.severity == "danger"
        assert sig.score >= 0.85
        assert any("surveillance" in ev.lower() or "accessibility" in ev.lower() for ev in sig.evidence)

    def test_device_admin_permission_returns_danger(self) -> None:
        meta = {
            "file_name": "System_Security_Update.apk",
            "permissions": ["android.permission.BIND_DEVICE_ADMIN"],
            "source": "sms_link",
        }
        sig = apk_triage.detect(meta)
        assert sig.severity == "danger"

    def test_harmless_calculator_from_play_store_returns_ok(self) -> None:
        meta = {
            "file_name": "Scientific_Calculator.apk",
            "permissions": ["android.permission.VIBRATE"],
            "source": "google_play",
        }
        sig = apk_triage.detect(meta)
        assert sig.severity == "ok"
        assert sig.score == 0.0

    def test_sideload_without_sensitive_permissions_returns_caution(self) -> None:
        meta = {
            "file_name": "Custom_Launcher.apk",
            "permissions": ["android.permission.INTERNET"],
            "source": "direct_browser_download",
        }
        sig = apk_triage.detect(meta)
        assert sig.severity in ("ok", "caution")

    def test_empty_metadata_safe_handling(self) -> None:
        meta = {"file_name": "", "permissions": [], "source": "google_play"}
        sig = apk_triage.detect(meta)
        assert sig.severity == "ok"


class TestAPKMetaEndpoint:
    """Verify POST /api/check/apk-meta API endpoint."""

    def test_api_check_apk_meta_danger(self, client: TestClient) -> None:
        payload = {
            "file_name": "Electricity_Bill_Instant.apk",
            "permissions": ["android.permission.READ_SMS", "android.permission.RECEIVE_SMS"],
            "source": "sms_link",
        }
        res = client.post("/api/check/apk-meta", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["verdict"] == "DANGER"
        assert len(data["reasons"]) >= 1
        assert "apk_triage" == data["reasons"][0]["detector"]
        assert len(data["next_steps"]) > 0

    def test_api_check_apk_meta_harmless(self, client: TestClient) -> None:
        payload = {
            "file_name": "Flashlight_Pro.apk",
            "permissions": ["android.permission.CAMERA"],
            "source": "google_play",
        }
        res = client.post("/api/check/apk-meta", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["verdict"] == "UNVERIFIED"
        assert "app" in data["explanation"]["en"].lower() or "metadata" in data["explanation"]["en"].lower()
