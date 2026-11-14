"""SQLModel database models for QRaksha-Kavach.

Tables:
  - Merchant: registered merchant directory
  - Scan: individual QR / UPI scan events (coarse lat/lng, 3-decimal)
  - Alert: risk verdicts emitted per scan
  - FlaggedPayee: community-flagged suspicious UPI IDs
  - Message: suspicious messages submitted for analysis
  - LLMCache: cached LLM responses keyed by prompt hash

Privacy:
  - GPS coordinates are truncated to 3 decimal places (~111 m precision)
  - No UPI PINs, OTPs, passwords, or exact locations are ever stored
"""

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    """Return current UTC timestamp."""
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Merchant
# ---------------------------------------------------------------------------

class Merchant(SQLModel, table=True):
    """Known merchant from the verified directory."""

    __tablename__ = "merchants"

    id: Optional[int] = Field(default=None, primary_key=True)
    shop_code: str = Field(index=True, unique=True, max_length=20,
                           description="Human-readable code e.g. KIR-0001")
    name: str = Field(max_length=120)
    upi_id: str = Field(index=True, max_length=80,
                        description="UPI VPA e.g. name@okaxis")
    category: str = Field(max_length=60, default="general")
    coarse_lat: float = Field(
        description="Latitude truncated to 3 decimals (~111 m)")
    coarse_lng: float = Field(
        description="Longitude truncated to 3 decimals (~111 m)")
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=_utcnow)


# ---------------------------------------------------------------------------
# Scan
# ---------------------------------------------------------------------------

class Scan(SQLModel, table=True):
    """A single QR / UPI scan event submitted by a user."""

    __tablename__ = "scans"

    id: Optional[int] = Field(default=None, primary_key=True)
    merchant_id: Optional[int] = Field(
        default=None, index=True,
        description="Associated merchant ID if identified",
    )
    upi_id: str = Field(max_length=80, index=True,
                        description="Extracted UPI VPA from the scan")
    pn: Optional[str] = Field(
        default=None, max_length=120,
        description="Payee name from QR parameters",
    )
    mc: Optional[str] = Field(
        default=None, max_length=20,
        description="Merchant category code from QR",
    )
    coarse_lat: Optional[float] = Field(
        default=None,
        description="User lat truncated to 3 decimals (~111 m)")
    coarse_lng: Optional[float] = Field(
        default=None,
        description="User lng truncated to 3 decimals (~111 m)")
    raw_payload: Optional[str] = Field(
        default=None, max_length=500,
        description="Decoded QR string (redacted of sensitive fields)")
    verdict: Optional[str] = Field(
        default=None, max_length=20,
        description="safe / suspicious / dangerous")
    created_at: datetime = Field(default_factory=_utcnow)


# ---------------------------------------------------------------------------
# Alert
# ---------------------------------------------------------------------------

class Alert(SQLModel, table=True):
    """Risk verdict emitted after analysing a scan or a merchant alert."""

    __tablename__ = "alerts"

    id: Optional[int] = Field(default=None, primary_key=True)
    merchant_id: Optional[int] = Field(
        default=None, index=True,
        description="Target merchant for merchant-facing alerts",
    )
    scan_id: Optional[int] = Field(
        default=None, index=True,
        description="Associated scan ID if triggered by user scan",
    )
    type: str = Field(
        default="qr_swap", max_length=50,
        description="Alert type e.g. qr_swap, drift",
    )
    risk_level: str = Field(
        default="danger", max_length=20,
        description="low / medium / high / danger / critical",
    )
    count: int = Field(
        default=1,
        description="Number of duplicate scans aggregated within rate limit",
    )
    seen: bool = Field(
        default=False,
        description="Whether the merchant has reviewed this alert",
    )
    details_json: Optional[str] = Field(
        default=None,
        description="Contextual JSON details e.g. observed UPI, distance",
    )
    signals_json: str = Field(
        default="[]",
        description="JSON array of Signal dicts that contributed to verdict")
    explanation_key: Optional[str] = Field(
        default=None, max_length=80,
        description="Key into explanations.yaml for user-facing message")
    created_at: datetime = Field(default_factory=_utcnow)


# ---------------------------------------------------------------------------
# FlaggedPayee
# ---------------------------------------------------------------------------

class FlaggedPayee(SQLModel, table=True):
    """Community-flagged suspicious UPI IDs and URLs linked to scam stories."""

    __tablename__ = "flagged_payees"

    id: Optional[int] = Field(default=None, primary_key=True)
    value: Optional[str] = Field(
        default=None, index=True, max_length=200,
        description="Flagged identifier: UPI VPA or URL",
    )
    upi_id: Optional[str] = Field(
        default=None, index=True, max_length=80,
        description="UPI VPA if kind is vpa",
    )
    kind: str = Field(
        default="vpa", max_length=20,
        description="Identifier kind: vpa or url",
    )
    source_message_id: Optional[int] = Field(
        default=None, index=True,
        description="ID of the scam message that cited this payee",
    )
    source_message_text: Optional[str] = Field(
        default=None, max_length=500,
        description="Snippet of the source message for quoting in alerts",
    )
    score: float = Field(
        default=0.8,
        description="Scam confidence score of the source story",
    )
    reason: str = Field(max_length=200, default="community report")
    report_count: int = Field(default=1)
    created_at: datetime = Field(default_factory=_utcnow)


# ---------------------------------------------------------------------------
# Message
# ---------------------------------------------------------------------------

class Message(SQLModel, table=True):
    """Suspicious message submitted for scam analysis."""

    __tablename__ = "messages"

    id: Optional[int] = Field(default=None, primary_key=True)
    scan_id: Optional[int] = Field(default=None, index=True)
    text: str = Field(max_length=2000,
                      description="Message body submitted by user")
    score: Optional[float] = Field(
        default=None,
        description="Scam score from detector",
    )
    labels_json: str = Field(
        default="[]",
        description="JSON array of scam category labels",
    )
    language: Optional[str] = Field(default=None, max_length=10)
    source: str = Field(max_length=30, default="user_input",
                        description="user_input / ocr / voice")
    created_at: datetime = Field(default_factory=_utcnow)


# ---------------------------------------------------------------------------
# LLMCache
# ---------------------------------------------------------------------------

class LLMCache(SQLModel, table=True):
    """Cached LLM responses keyed by prompt hash."""

    __tablename__ = "llm_cache"

    id: Optional[int] = Field(default=None, primary_key=True)
    prompt_hash: str = Field(index=True, unique=True, max_length=64,
                             description="SHA-256 hex of the prompt text")
    prompt_text: str = Field(description="Original prompt sent to the LLM")
    response_text: str = Field(description="Raw response from the LLM")
    model_name: Optional[str] = Field(default=None, max_length=60)
    created_at: datetime = Field(default_factory=_utcnow)

