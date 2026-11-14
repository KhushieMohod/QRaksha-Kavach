"""Tests for voice transcription and scam checking (SPEC Section 6.9)."""

from pathlib import Path
import io
from fastapi.testclient import TestClient
import pytest
from sqlmodel import Session, SQLModel, create_engine

from app.database import get_session
from app.main import app


@pytest.fixture(name="client")
def fixture_client(tmp_path: Path):
    db_file = tmp_path / "test_voice.db"
    engine = create_engine(f"sqlite:///{db_file}", echo=False)
    SQLModel.metadata.create_all(engine)

    def _get_test_session():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = _get_test_session
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()
    engine.dispose()


class TestVoiceCheckEndpoint:
    """Verify POST /api/check/voice using offline pre-cached transcripts."""

    def test_voice_check_cached_digital_arrest(self, client: TestClient) -> None:
        """Cached digital arrest voice sample triggers DANGER verdict."""
        res = client.post("/api/check/voice", data={"cached_key": "digital_arrest"})
        assert res.status_code == 200
        data = res.json()
        assert data["verdict"] == "DANGER"
        assert len(data["reasons"]) >= 1
        assert "scam_text" == data["reasons"][0]["detector"]
        assert len(data["next_steps"]) > 0

    def test_voice_check_cached_telugu_bill(self, client: TestClient) -> None:
        """Cached Telugu electricity bill voice sample triggers scam text check."""
        res = client.post("/api/check/voice", data={"cached_key": "telugu_bill"})
        assert res.status_code == 200
        data = res.json()
        # Should detect urgency threat / bill lure
        assert data["verdict"] in ("DANGER", "CAUTION")

    def test_voice_check_cached_english_bill(self, client: TestClient) -> None:
        """Cached English electricity bill voice note triggers scam detection."""
        res = client.post("/api/check/voice", data={"cached_key": "english_bill"})
        assert res.status_code == 200
        data = res.json()
        assert data["verdict"] in ("DANGER", "CAUTION")

    def test_voice_check_legitimate_audio(self, client: TestClient) -> None:
        """Harmless family shopping voice note returns UNVERIFIED."""
        res = client.post("/api/check/voice", data={"cached_key": "legitimate_chat"})
        assert res.status_code == 200
        data = res.json()
        assert data["verdict"] == "UNVERIFIED"
        assert "no scam signs" in data["explanation"]["en"].lower()

    def test_voice_check_text_override(self, client: TestClient) -> None:
        """Direct text override flows into scam text check."""
        text = "Your KYC expires today. Install KYC_Update.apk now."
        res = client.post("/api/check/voice", data={"text_override": text})
        assert res.status_code == 200
        data = res.json()
        assert data["verdict"] in ("DANGER", "CAUTION")

    def test_voice_check_uploaded_file_fallback(self, client: TestClient) -> None:
        """Uploading audio file uses cached transcript fallback when offline."""
        fake_audio_bytes = b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
        files = {"file": ("cbi_arrest_voice.wav", io.BytesIO(fake_audio_bytes), "audio/wav")}
        res = client.post("/api/check/voice", files=files)
        assert res.status_code == 200
        data = res.json()
        assert data["verdict"] == "DANGER"
        assert data["latency_ms"] >= 0
        assert data["request_id"].startswith("r_")
