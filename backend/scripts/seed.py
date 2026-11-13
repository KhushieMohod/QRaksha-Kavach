"""Seed the SQLite database with synthetic merchant data.

Usage:
    python backend/scripts/seed.py
    or
    python -m scripts.seed

This script is idempotent — running it multiple times will not create
duplicate merchants. It checks for existing shop_code before inserting.
"""

import json
import sys
from pathlib import Path

from sqlmodel import Session, select

# Ensure backend directory and project root are on sys.path
_backend_dir = Path(__file__).resolve().parents[1]
_project_root = _backend_dir.parent
for path in (str(_backend_dir), str(_project_root)):
    if path not in sys.path:
        sys.path.insert(0, path)

from app.database import create_db_and_tables, engine  # noqa: E402
from app.models import Merchant  # noqa: E402

DATA_FILE = _project_root / "data" / "merchants.json"


def load_merchants_json() -> list[dict]:
    """Read the merchants seed file."""
    with open(DATA_FILE, "r", encoding="utf-8") as fh:
        return json.load(fh)


def seed_merchants(target_engine=None) -> int:
    """Insert merchants that do not already exist. Returns count of new rows."""
    active_engine = target_engine or engine
    create_db_and_tables()
    merchants_data = load_merchants_json()
    inserted = 0

    with Session(active_engine) as session:
        for item in merchants_data:
            existing = session.exec(
                select(Merchant).where(
                    Merchant.shop_code == item["shop_code"]
                )
            ).first()
            if existing is not None:
                continue

            merchant = Merchant(
                shop_code=item["shop_code"],
                name=item["name"],
                upi_id=item["upi_id"],
                category=item.get("category", "general"),
                coarse_lat=round(item["coarse_lat"], 3),
                coarse_lng=round(item["coarse_lng"], 3),
            )
            session.add(merchant)
            inserted += 1

        session.commit()

    return inserted


def main() -> None:
    """Entry point for seeding."""
    count = seed_merchants()
    print(f"Seed complete. {count} new merchant(s) inserted.")

    # Show total count
    with Session(engine) as session:
        total = len(session.exec(select(Merchant)).all())
    print(f"Total merchants in database: {total}")


if __name__ == "__main__":
    main()
