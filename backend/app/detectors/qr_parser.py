"""UPI QR Code Parser and Validator (SPEC Section 6.1).

Parses URI links of the form:
  upi://pay?pa=<address>&pn=<name>&mc=<code>&am=<amount>&tn=<note>

Security Note:
  The 'pn' (payee name) parameter is typed by whoever generated the QR.
  NEVER treat 'pn' as proof of identity.
"""

import re
from typing import Optional
from urllib.parse import parse_qs, unquote, urlparse
from pydantic import BaseModel, Field

from app.signals import Signal

DETECTOR_NAME = "qr_parser"


class UPIPayload(BaseModel):
    """Structured fields extracted from a valid UPI payment URI."""

    pa: str = Field(description="Payee VPA / UPI ID (e.g. name@okaxis)")
    pn: Optional[str] = Field(default=None, description="Payee name (untrusted)")
    mc: Optional[str] = Field(default=None, description="Merchant code")
    am: Optional[float] = Field(default=None, description="Amount")
    tn: Optional[str] = Field(default=None, description="Transaction note")
    raw_payload: str = Field(description="Original unparsed string")


class QRParseResult(BaseModel):
    """Result of QR parsing, containing extracted payload and detector signal."""

    is_valid: bool
    payload: Optional[UPIPayload] = None
    signal: Signal


def parse_qr(raw_input: str) -> QRParseResult:
    """Parse and validate a UPI QR payload string.

    Returns QRParseResult with extracted payload and Signal object.
    Follows SPEC Table 6.1:
      - Valid upi://pay links extract fields.
      - Missing 'pa' is invalid.
      - Non-UPI link is invalid.
      - Odd / negative amount is valid but flagged with caution.
      - Payee address containing spaces is invalid.
    """
    raw = (raw_input or "").strip()

    # Case: Empty input
    if not raw:
        sig = Signal.danger(
            detector=DETECTOR_NAME,
            score=1.0,
            evidence=["Empty QR payload provided"],
            explanation_key="qr_empty",
        )
        return QRParseResult(is_valid=False, payload=None, signal=sig)

    # Check for whitespace inside pa if provided as raw string or query param
    if " " in raw and not raw.startswith("upi://"):
        sig = Signal.danger(
            detector=DETECTOR_NAME,
            score=1.0,
            evidence=["Invalid UPI link format: contains spaces or missing upi scheme"],
            explanation_key="qr_invalid_format",
        )
        return QRParseResult(is_valid=False, payload=None, signal=sig)

    # Must be a UPI URI
    parsed_url = urlparse(raw)
    if parsed_url.scheme.lower() != "upi":
        sig = Signal.danger(
            detector=DETECTOR_NAME,
            score=1.0,
            evidence=[f"Not a UPI link: scheme is '{parsed_url.scheme or 'unknown'}'"],
            explanation_key="qr_not_upi",
        )
        return QRParseResult(is_valid=False, payload=None, signal=sig)

    # Must target 'pay'
    if parsed_url.netloc.lower() != "pay" and parsed_url.path.lower() != "//pay" and parsed_url.path.lower() != "pay":
        sig = Signal.danger(
            detector=DETECTOR_NAME,
            score=1.0,
            evidence=[f"Unsupported UPI action: expected 'pay', got '{parsed_url.netloc}'"],
            explanation_key="qr_unsupported_action",
        )
        return QRParseResult(is_valid=False, payload=None, signal=sig)

    # Parse query parameters
    query_str = parsed_url.query
    params = parse_qs(query_str, keep_blank_values=True)

    # Check for mandatory 'pa' (payee address)
    pa_list = params.get("pa", [])
    if not pa_list or not pa_list[0].strip():
        sig = Signal.danger(
            detector=DETECTOR_NAME,
            score=1.0,
            evidence=["Missing mandatory 'pa' (payee address) parameter"],
            explanation_key="qr_missing_pa",
        )
        return QRParseResult(is_valid=False, payload=None, signal=sig)

    pa = pa_list[0].strip()

    # Payee address cannot contain internal spaces
    if " " in pa:
        sig = Signal.danger(
            detector=DETECTOR_NAME,
            score=1.0,
            evidence=[f"Invalid payee address '{pa}': contains whitespace"],
            explanation_key="qr_invalid_pa",
        )
        return QRParseResult(is_valid=False, payload=None, signal=sig)

    # Must contain '@' with non-empty parts
    if "@" not in pa or pa.startswith("@") or pa.endswith("@"):
        sig = Signal.danger(
            detector=DETECTOR_NAME,
            score=1.0,
            evidence=[f"Malformed UPI ID '{pa}': missing valid @handle structure"],
            explanation_key="qr_invalid_pa",
        )
        return QRParseResult(is_valid=False, payload=None, signal=sig)

    # Extract optional fields
    pn = params.get("pn", [None])[0]
    if pn:
        pn = unquote(pn).strip()

    mc = params.get("mc", [None])[0]
    if mc:
        mc = mc.strip()

    tn = params.get("tn", [None])[0]
    if tn:
        tn = unquote(tn).strip()

    # Parse amount if present
    am_raw = params.get("am", [None])[0]
    am_val: Optional[float] = None
    odd_amount = False
    amount_evidence: Optional[str] = None

    if am_raw is not None and am_raw.strip() != "":
        try:
            am_val = float(am_raw.strip())
            if am_val <= 0:
                odd_amount = True
                amount_evidence = f"Odd or negative transaction amount: {am_raw}"
        except ValueError:
            odd_amount = True
            amount_evidence = f"Non-numeric transaction amount: '{am_raw}'"

    payload = UPIPayload(
        pa=pa,
        pn=pn,
        mc=mc,
        am=am_val,
        tn=tn,
        raw_payload=raw,
    )

    if odd_amount:
        sig = Signal.caution(
            detector=DETECTOR_NAME,
            score=0.6,
            evidence=[
                f"Valid UPI link with suspicious amount: {amount_evidence}",
                f"Payee VPA: {pa}",
                "Note: 'pn' name field is unverified user input",
            ],
            explanation_key="qr_odd_amount",
        )
        return QRParseResult(is_valid=True, payload=payload, signal=sig)

    # Valid UPI QR
    sig = Signal.ok(
        detector=DETECTOR_NAME,
        evidence=[
            f"Valid UPI QR link parsed successfully",
            f"Payee VPA: {pa}",
            "Note: 'pn' name field is unverified user input and never treated as identity proof",
        ],
    )
    return QRParseResult(is_valid=True, payload=payload, signal=sig)


def detect(raw_qr: str) -> Signal:
    """Detector interface returning Signal directly as required by SPEC Section 4.2."""
    return parse_qr(raw_qr).signal

