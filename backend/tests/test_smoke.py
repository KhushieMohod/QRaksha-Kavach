"""Smoke tests — verify the FastAPI app boots and the health endpoint responds."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint() -> None:
    """GET /health should return 200 with status ok."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_app_title() -> None:
    """App metadata should match project name."""
    assert app.title == "QRaksha-Kavach"

