"""QRaksha-Kavach — FastAPI application entry point."""

from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.database import create_db_and_tables, get_session
from app.models import Alert, Merchant


class MerchantRegisterRequest(BaseModel):
    """Payload for registering a new merchant."""

    name: str = Field(description="Business or shop name")
    upi_id: str = Field(description="Registered UPI VPA (e.g. name@okaxis)")
    lat: float = Field(description="Shop latitude (stored to 3 decimals)")
    lng: float = Field(description="Shop longitude (stored to 3 decimals)")
    shop_code: Optional[str] = Field(
        default=None,
        description="Optional unique shop code (e.g. KIR-0042). Auto-generated if omitted.",
    )
    category: Optional[str] = Field(
        default="general",
        description="Business category",
    )


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
            "id": m.id,
            "shop_code": m.shop_code,
            "name": m.name,
            "upi_id": m.upi_id,
            "category": m.category,
            "coarse_lat": m.coarse_lat,
            "coarse_lng": m.coarse_lng,
        }
        for m in merchants
    ]


@app.post("/api/merchant/register", status_code=status.HTTP_201_CREATED)
def register_merchant(
    payload: MerchantRegisterRequest,
    session: Session = Depends(get_session),
) -> dict:
    """Register a new merchant into the verified directory.

    Coordinates are rounded to 3 decimal places (~111 m) to ensure privacy.
    Shop code is validated for uniqueness or auto-generated.
    """
    coarse_lat = round(payload.lat, 3)
    coarse_lng = round(payload.lng, 3)

    if payload.shop_code:
        clean_code = payload.shop_code.strip().upper()
        existing = session.exec(
            select(Merchant).where(Merchant.shop_code == clean_code)
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Shop code {clean_code} is already registered.",
            )
        shop_code = clean_code
    else:
        # Auto-generate next available code
        total_merchants = len(session.exec(select(Merchant)).all())
        candidate_code = f"KIR-{total_merchants + 1:04d}"
        # Ensure candidate doesn't conflict
        while session.exec(select(Merchant).where(Merchant.shop_code == candidate_code)).first():
            total_merchants += 1
            candidate_code = f"KIR-{total_merchants + 1:04d}"
        shop_code = candidate_code

    merchant = Merchant(
        shop_code=shop_code,
        name=payload.name.strip(),
        upi_id=payload.upi_id.strip(),
        category=payload.category.strip() if payload.category else "general",
        coarse_lat=coarse_lat,
        coarse_lng=coarse_lng,
        is_active=True,
    )
    session.add(merchant)
    session.commit()
    session.refresh(merchant)

    return {
        "id": merchant.id,
        "shop_code": merchant.shop_code,
        "name": merchant.name,
        "upi_id": merchant.upi_id,
        "category": merchant.category,
        "coarse_lat": merchant.coarse_lat,
        "coarse_lng": merchant.coarse_lng,
        "created_at": merchant.created_at.isoformat() if merchant.created_at else None,
    }


@app.get("/api/merchant/{id}/alerts")
def get_merchant_alerts(
    id: str,
    session: Session = Depends(get_session),
) -> list[dict]:
    """Retrieve security alerts for a given merchant.

    The path parameter 'id' can be either an integer merchant ID or
    a shop code string (e.g. 'KIR-0001').
    """
    merchant: Optional[Merchant] = None
    if id.isdigit():
        merchant = session.get(Merchant, int(id))
    if merchant is None:
        merchant = session.exec(
            select(Merchant).where(Merchant.shop_code == id.strip().upper())
        ).first()

    if merchant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Merchant '{id}' not found.",
        )

    alerts = session.exec(
        select(Alert)
        .where(Alert.merchant_id == merchant.id)
        .order_by(Alert.created_at.desc())
    ).all()

    return [
        {
            "id": a.id,
            "merchant_id": a.merchant_id,
            "scan_id": a.scan_id,
            "type": a.type,
            "risk_level": a.risk_level,
            "count": a.count,
            "seen": a.seen,
            "details_json": a.details_json,
            "explanation_key": a.explanation_key,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in alerts
    ]
