"""Tests for database models, seed script, and /api/merchants endpoint."""

import json
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select

from app.database import get_session
from app.main import app
from app.models import (
    Alert,
    FlaggedPayee,
    LLMCache,
    Merchant,
    Message,
    Scan,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(name="engine")
def fixture_engine(tmp_path: Path):
    """Create a fresh in-memory SQLite engine for each test."""
    db_path = tmp_path / "test.db"
    engine = create_engine(f"sqlite:///{db_path}", echo=False)
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture(name="session")
def fixture_session(engine):
    """Yield a session bound to the test engine."""
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def fixture_client(engine):
    """TestClient that uses the test database."""

    def _override_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = _override_session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Table creation tests
# ---------------------------------------------------------------------------

class TestTableCreation:
    """Verify all six tables are created."""

    def test_all_tables_exist(self, engine) -> None:
        """SQLModel.metadata should contain all six expected tables."""
        table_names = set(SQLModel.metadata.tables.keys())
        expected = {"merchants", "scans", "alerts", "flagged_payees",
                    "messages", "llm_cache"}
        assert expected.issubset(table_names), (
            f"Missing tables: {expected - table_names}"
        )


# ---------------------------------------------------------------------------
# Merchant model tests
# ---------------------------------------------------------------------------

class TestMerchantModel:
    """Verify Merchant CRUD and constraints."""

    def test_create_merchant(self, session: Session) -> None:
        """Should insert and retrieve a merchant."""
        m = Merchant(
            shop_code="KIR-TEST",
            name="Test Shop",
            upi_id="test@okaxis",
            category="grocery",
            coarse_lat=17.385,
            coarse_lng=78.487,
        )
        session.add(m)
        session.commit()
        session.refresh(m)

        assert m.id is not None
        assert m.shop_code == "KIR-TEST"
        assert m.is_active is True

    def test_coarse_coordinates_precision(self, session: Session) -> None:
        """Coordinates should have at most 3 decimal places."""
        m = Merchant(
            shop_code="KIR-PREC",
            name="Precision Test",
            upi_id="prec@okaxis",
            coarse_lat=round(17.38501234, 3),
            coarse_lng=round(78.48699876, 3),
        )
        session.add(m)
        session.commit()
        session.refresh(m)

        # 3 decimal places => ~111 m precision
        assert m.coarse_lat == 17.385
        assert m.coarse_lng == 78.487

    def test_unique_shop_code(self, session: Session) -> None:
        """Duplicate shop_code should raise an integrity error."""
        m1 = Merchant(
            shop_code="KIR-DUP", name="First", upi_id="a@okaxis",
            coarse_lat=17.385, coarse_lng=78.487,
        )
        session.add(m1)
        session.commit()

        m2 = Merchant(
            shop_code="KIR-DUP", name="Second", upi_id="b@okaxis",
            coarse_lat=17.386, coarse_lng=78.488,
        )
        session.add(m2)
        with pytest.raises(Exception):
            session.commit()


# ---------------------------------------------------------------------------
# Scan model tests
# ---------------------------------------------------------------------------

class TestScanModel:
    """Verify Scan model stores coarse coordinates."""

    def test_create_scan_with_coarse_coords(self, session: Session) -> None:
        """Scan should store 3-decimal lat/lng."""
        s = Scan(
            upi_id="test@okaxis",
            coarse_lat=round(17.38512, 3),
            coarse_lng=round(78.48723, 3),
        )
        session.add(s)
        session.commit()
        session.refresh(s)

        assert s.coarse_lat == 17.385
        assert s.coarse_lng == 78.487
        assert s.verdict is None

    def test_scan_without_location(self, session: Session) -> None:
        """Scan should work without GPS coordinates."""
        s = Scan(upi_id="noloc@okaxis")
        session.add(s)
        session.commit()
        session.refresh(s)

        assert s.coarse_lat is None
        assert s.coarse_lng is None


# ---------------------------------------------------------------------------
# Other model smoke tests
# ---------------------------------------------------------------------------

class TestOtherModels:
    """Quick create tests for Alert, FlaggedPayee, Message, LLMCache."""

    def test_create_alert(self, session: Session) -> None:
        alert = Alert(scan_id=1, risk_level="low")
        session.add(alert)
        session.commit()
        session.refresh(alert)
        assert alert.id is not None

    def test_create_flagged_payee(self, session: Session) -> None:
        fp = FlaggedPayee(upi_id="scammer@okaxis", reason="phishing")
        session.add(fp)
        session.commit()
        session.refresh(fp)
        assert fp.report_count == 1

    def test_create_message(self, session: Session) -> None:
        msg = Message(text="You won a prize! Send money.", source="user_input")
        session.add(msg)
        session.commit()
        session.refresh(msg)
        assert msg.id is not None

    def test_create_llm_cache(self, session: Session) -> None:
        cache = LLMCache(
            prompt_hash="abc123",
            prompt_text="Is this a scam?",
            response_text='{"classification": "suspicious"}',
            model_name="test-model",
        )
        session.add(cache)
        session.commit()
        session.refresh(cache)
        assert cache.id is not None


# ---------------------------------------------------------------------------
# Seed data validation tests
# ---------------------------------------------------------------------------

class TestSeedData:
    """Validate data/merchants.json content."""

    @pytest.fixture()
    def merchants_data(self) -> list[dict]:
        """Load the seed data file."""
        data_file = Path(__file__).resolve().parents[2] / "data" / "merchants.json"
        with open(data_file, "r", encoding="utf-8") as fh:
            return json.load(fh)

    def test_has_20_merchants(self, merchants_data: list[dict]) -> None:
        assert len(merchants_data) == 20

    def test_shop_codes_sequential(self, merchants_data: list[dict]) -> None:
        codes = [m["shop_code"] for m in merchants_data]
        expected = [f"KIR-{i:04d}" for i in range(1, 21)]
        assert codes == expected

    def test_upi_ids_format(self, merchants_data: list[dict]) -> None:
        """All UPI IDs should end with @okaxis."""
        for m in merchants_data:
            assert m["upi_id"].endswith("@okaxis"), (
                f"{m['shop_code']} has invalid UPI: {m['upi_id']}"
            )

    def test_coordinates_in_3km_box(self, merchants_data: list[dict]) -> None:
        """All merchants should be within ~3 km of 17.385, 78.487."""
        center_lat, center_lng = 17.385, 78.487
        # ~3 km ≈ 0.027 degrees latitude, ~0.029 degrees longitude at this lat
        for m in merchants_data:
            assert abs(m["coarse_lat"] - center_lat) <= 0.027, (
                f"{m['shop_code']} lat out of range"
            )
            assert abs(m["coarse_lng"] - center_lng) <= 0.029, (
                f"{m['shop_code']} lng out of range"
            )

    def test_two_shops_close_together(self, merchants_data: list[dict]) -> None:
        """At least two shops should be ~60 m apart (same 3-decimal coords)."""
        coords = [(m["coarse_lat"], m["coarse_lng"]) for m in merchants_data]
        # Shops at the same 3-decimal coord are within ~111 m
        from collections import Counter
        coord_counts = Counter(coords)
        close_pairs = {c: n for c, n in coord_counts.items() if n >= 2}
        assert len(close_pairs) >= 1, (
            "Need at least two shops with nearly identical coordinates"
        )

    def test_no_exact_gps_stored(self, merchants_data: list[dict]) -> None:
        """Coordinates should have at most 3 decimal places."""
        for m in merchants_data:
            lat_str = str(m["coarse_lat"])
            lng_str = str(m["coarse_lng"])
            if "." in lat_str:
                assert len(lat_str.split(".")[1]) <= 3
            if "." in lng_str:
                assert len(lng_str.split(".")[1]) <= 3


# ---------------------------------------------------------------------------
# Seed idempotency test
# ---------------------------------------------------------------------------

class TestSeedIdempotency:
    """Verify seed.py is idempotent via its core function."""

    def test_seed_twice_no_duplicates(self, tmp_path: Path) -> None:
        """Running seed twice should not create duplicate merchants."""
        import scripts.seed as seed_module

        # Point DB at a temp file
        db_path = tmp_path / "idempotent_test.db"
        test_engine = create_engine(f"sqlite:///{db_path}", echo=False)
        SQLModel.metadata.create_all(test_engine)

        # First seed with test_engine
        count1 = seed_module.seed_merchants(target_engine=test_engine)
        assert count1 == 20, f"First seed should insert 20, got {count1}"

        # Second seed with test_engine
        count2 = seed_module.seed_merchants(target_engine=test_engine)
        assert count2 == 0, f"Second seed should insert 0, got {count2}"

        # Verify total
        with Session(test_engine) as session:
            total = len(session.exec(select(Merchant)).all())
        assert total == 20, f"Total should be 20, got {total}"


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------

class TestMerchantAPI:
    """Test the GET /api/merchants endpoint."""

    def test_merchants_empty(self, client) -> None:
        """With no seed data, merchants list should be empty."""
        resp = client.get("/api/merchants")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_merchants_returns_seeded_data(self, client, engine) -> None:
        """After inserting a merchant, the API should return it."""
        with Session(engine) as session:
            m = Merchant(
                shop_code="KIR-API1",
                name="API Test Shop",
                upi_id="apitest@okaxis",
                category="test",
                coarse_lat=17.385,
                coarse_lng=78.487,
            )
            session.add(m)
            session.commit()

        resp = client.get("/api/merchants")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["shop_code"] == "KIR-API1"
        assert data[0]["upi_id"] == "apitest@okaxis"

    def test_inactive_merchants_excluded(self, client, engine) -> None:
        """Inactive merchants should not appear in the list."""
        with Session(engine) as session:
            m = Merchant(
                shop_code="KIR-INACT",
                name="Inactive Shop",
                upi_id="inactive@okaxis",
                coarse_lat=17.385,
                coarse_lng=78.487,
                is_active=False,
            )
            session.add(m)
            session.commit()

        resp = client.get("/api/merchants")
        assert resp.status_code == 200
        assert len(resp.json()) == 0

