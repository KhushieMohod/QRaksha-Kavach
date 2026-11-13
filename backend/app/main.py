"""QRaksha-Kavach — FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from sqlmodel import Session, select

from app.database import create_db_and_tables, get_session
from app.models import Merchant


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Create DB tables on startup."""
    create_db_and_tables()
    yield


app = FastAPI(
    title="QRaksha-Kavach",
    description="Check Before You Pay — scam detection API",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health() -> dict[str, str]:
    """Health-check endpoint."""
    return {"status": "ok"}


@app.get("/api/merchants")
def list_merchants(
    session: Session = Depends(get_session),
) -> list[dict]:
    """Return all active merchants."""
    merchants = session.exec(
        select(Merchant).where(Merchant.is_active == True)  # noqa: E712
    ).all()
    return [
        {
            "shop_code": m.shop_code,
            "name": m.name,
            "upi_id": m.upi_id,
            "category": m.category,
            "coarse_lat": m.coarse_lat,
            "coarse_lng": m.coarse_lng,
        }
        for m in merchants
    ]
