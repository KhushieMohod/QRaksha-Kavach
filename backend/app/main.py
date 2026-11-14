"""QRaksha-Kavach — FastAPI application entry point."""

import time
import uuid
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.database import create_db_and_tables, get_session
from app.detectors import (
    crowd_baseline,
    handle_lookalike,
    ocr,
    qr_parser,
    registry_binding,
    scam_text,
    story_link,
)
from app.fusion import (
    CheckResponse,
    ExplanationDict,
    ReasonItem,
    _get_explanation_data,
    fuse_signals,
)
from app.models import Alert, Merchant, Message, Scan
from app.signals import Signal


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


class CheckQRRequest(BaseModel):
    """Payload for checking a UPI QR code (SPEC Section 4.4)."""

    payload: str = Field(description="Raw UPI URI payload e.g. upi://pay?pa=...")
    lat: Optional[float] = Field(default=None, description="Optional scan latitude")
    lng: Optional[float] = Field(default=None, description="Optional scan longitude")
    shop_code: Optional[str] = Field(default=None, description="Optional merchant shop code")


class CheckTextRequest(BaseModel):
    """Payload for checking a message text (SPEC Section 4.4)."""

    text: str = Field(description="Suspicious message body to analyze")


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


# ---------------------------------------------------------------------------
# Check Endpoints & Internal Orchestration (SPEC Section 4.4 & Section 7)
# ---------------------------------------------------------------------------

def _perform_qr_check(
    payload: CheckQRRequest,
    session: Session,
    start_time: float,
    req_id: str,
) -> CheckResponse:
    """Internal workflow to analyze a QR payload across all relevant detectors."""
    signals: list[Signal] = []

    # 1. Parse QR payload
    parsed = qr_parser.parse_qr(payload.payload)
    signals.append(parsed.signal)

    vpa = parsed.payload.pa if parsed.is_valid else None
    pn = parsed.payload.pn if parsed.is_valid else None
    mc = parsed.payload.mc if parsed.is_valid else None

    # If VPA extracted, run payee-dependent detectors
    if vpa:
        # 2. Lookalike handle check
        lookalike_sig = handle_lookalike.detect(vpa)
        signals.append(lookalike_sig)

        # 3. Story link check
        story_sig = story_link.detect(vpa, session=session)
        signals.append(story_sig)

        # 4. Registry binding check
        reg_sig = registry_binding.detect(
            upi_id=vpa,
            coarse_lat=payload.lat,
            coarse_lng=payload.lng,
            shop_code=payload.shop_code,
            session=session,
            trigger_alert=True,
        )
        signals.append(reg_sig)

        # 5. Crowd baseline check (if no registered shop found and coordinates provided)
        if (
            payload.lat is not None
            and payload.lng is not None
            and reg_sig.explanation_key == "no_registry_data"
        ):
            crowd_sig = crowd_baseline.detect(
                upi_id=vpa,
                coarse_lat=payload.lat,
                coarse_lng=payload.lng,
                session=session,
            )
            signals.append(crowd_sig)

    # 6. Fuse all signals into one verdict
    fused = fuse_signals(signals, check_type="qr")

    # 7. Record scan in database (coarse 3-decimal lat/lng)
    coarse_lat = round(payload.lat, 3) if payload.lat is not None else None
    coarse_lng = round(payload.lng, 3) if payload.lng is not None else None
    scan = Scan(
        upi_id=vpa or "invalid_qr",
        coarse_lat=coarse_lat,
        coarse_lng=coarse_lng,
        raw_payload=payload.payload[:500],
        verdict=fused.verdict.lower(),
        pn=pn,
        mc=mc,
    )
    session.add(scan)
    session.commit()

    latency_ms = max(1, int((time.perf_counter() - start_time) * 1000))

    return CheckResponse(
        request_id=req_id,
        verdict=fused.verdict,
        reasons=fused.reasons,
        explanation=fused.explanation,
        next_steps=fused.next_steps,
        latency_ms=latency_ms,
    )


def _perform_text_check(
    payload: CheckTextRequest,
    session: Session,
    start_time: float,
    req_id: str,
    source: str = "user_input",
) -> CheckResponse:
    """Internal workflow to analyze message text."""
    # 1. Run scam_text detector
    sig = scam_text.detect(payload.text, session=session)

    # 2. Extract and link any payees if scam score >= scam_caution
    story_link.link_message_payees(
        session=session,
        message_text=payload.text,
        scam_score=sig.score,
    )

    # 3. Fuse signals
    fused = fuse_signals([sig], check_type="text")

    # 4. Record message in database
    msg = Message(
        text=payload.text[:2000],
        score=sig.score,
        source=source,
    )
    session.add(msg)
    session.commit()

    latency_ms = max(1, int((time.perf_counter() - start_time) * 1000))

    return CheckResponse(
        request_id=req_id,
        verdict=fused.verdict,
        reasons=fused.reasons,
        explanation=fused.explanation,
        next_steps=fused.next_steps,
        latency_ms=latency_ms,
    )


@app.post("/api/check/qr", response_model=CheckResponse)
def check_qr(
    payload: CheckQRRequest,
    session: Session = Depends(get_session),
) -> CheckResponse:
    """Analyze a UPI QR code payload and location against all detectors."""
    start_time = time.perf_counter()
    req_id = f"r_{uuid.uuid4().hex[:8]}"
    return _perform_qr_check(payload, session, start_time, req_id)


@app.post("/api/check/text", response_model=CheckResponse)
def check_text(
    payload: CheckTextRequest,
    session: Session = Depends(get_session),
) -> CheckResponse:
    """Analyze a suspicious message text using deterministic rules and LLM."""
    start_time = time.perf_counter()
    req_id = f"r_{uuid.uuid4().hex[:8]}"
    return _perform_text_check(payload, session, start_time, req_id, source="user_input")


@app.post("/api/check/image", response_model=CheckResponse)
async def check_image(
    file: UploadFile = File(...),
    lat: Optional[float] = Form(default=None),
    lng: Optional[float] = Form(default=None),
    shop_code: Optional[str] = Form(default=None),
    session: Session = Depends(get_session),
) -> CheckResponse:
    """Analyze an uploaded screenshot or photo.

    Decodes QR code first via OpenCV headless; otherwise runs OCR via Tesseract.
    """
    start_time = time.perf_counter()
    req_id = f"r_{uuid.uuid4().hex[:8]}"

    image_bytes = await file.read()
    img_result = ocr.process_image(image_bytes)

    # If QR code was decoded, process as QR check
    if img_result["type"] == "qr" and img_result["payload"]:
        qr_req = CheckQRRequest(
            payload=img_result["payload"],
            lat=lat,
            lng=lng,
            shop_code=shop_code,
        )
        return _perform_qr_check(qr_req, session, start_time, req_id)

    # If OCR had low confidence or was empty, prompt user to paste text
    if img_result["error"]:
        explanation, next_steps = _get_explanation_data("ocr_low_confidence")
        latency_ms = max(1, int((time.perf_counter() - start_time) * 1000))
        return CheckResponse(
            request_id=req_id,
            verdict="CAUTION",
            reasons=[
                ReasonItem(
                    detector="ocr",
                    severity="caution",
                    evidence=[img_result["error"]],
                    explanation_key="ocr_low_confidence",
                )
            ],
            explanation=explanation,
            next_steps=next_steps,
            latency_ms=latency_ms,
        )

    # Process extracted text
    text_req = CheckTextRequest(text=img_result["text"])
    return _perform_text_check(text_req, session, start_time, req_id, source="ocr")
