"""Story link detector (SPEC Section 6.6).

Connects suspicious scam messages/stories with payment identifiers:
  1. Extracts UPI IDs and web URLs from analyzed messages.
  2. If the message scam score is at least scam_caution (default 0.5),
     persists them into the flagged_payees table.
  3. During a payment check (e.g. QR scan or UPI validation), if the
     UPI ID matches a flagged payee, returns DANGER with evidence quoting
     the first 80 characters of the source scam message and its date.
"""

from datetime import datetime, timezone
import re
from typing import Optional

from sqlmodel import Session, select

from app.config.loader import load_thresholds
from app.models import FlaggedPayee
from app.signals import Signal

DETECTOR_NAME = "story_link"

# Regex for UPI VPAs: letters, digits, dots, hyphens or underscores, then @, then letters
UPI_REGEX = re.compile(r"[a-zA-Z0-9.\-_]+@[a-zA-Z]+", re.IGNORECASE)

# Regex for URLs and link shorteners
URL_REGEX = re.compile(
    r"https?://[^\s<>\"']+|(?:\b(?:bit\.ly|tinyurl\.com|cutt\.ly|goo\.gl|t\.co|is\.gd|rb\.gy)/[^\s<>\"']+)",
    re.IGNORECASE,
)


def extract_upi_ids(text: str) -> list[str]:
    """Extract UPI IDs from text and normalize to lowercase without trailing punctuation."""
    matches = UPI_REGEX.findall(text)
    results: list[str] = []
    seen = set()
    for m in matches:
        cleaned = m.strip().rstrip(".,;:!?").lower()
        if "@" in cleaned and cleaned not in seen:
            seen.add(cleaned)
            results.append(cleaned)
    return results


def extract_urls(text: str) -> list[str]:
    """Extract web links and shortened URLs from text."""
    matches = URL_REGEX.findall(text)
    results: list[str] = []
    seen = set()
    for m in matches:
        cleaned = m.strip().rstrip(".,;:!?")
        if cleaned.lower() not in seen:
            seen.add(cleaned.lower())
            results.append(cleaned)
    return results


def link_message_payees(
    session: Session,
    message_text: str,
    scam_score: float,
    message_id: Optional[int] = None,
    message_date: Optional[datetime] = None,
) -> list[FlaggedPayee]:
    """Extract and persist flagged UPI IDs and URLs from a scored scam message.

    Only persists if scam_score >= scam_caution (from thresholds.yaml).
    """
    thresholds = load_thresholds()
    scam_caution = float(thresholds.get("scam_caution", 0.5))

    if scam_score < scam_caution:
        return []

    flagged_entries: list[FlaggedPayee] = []
    ts = message_date or datetime.now(timezone.utc)
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)

    # 1. Process extracted UPI IDs
    upi_ids = extract_upi_ids(message_text)
    for vpa in upi_ids:
        # Check if already present in flagged_payees
        query = select(FlaggedPayee).where(
            (FlaggedPayee.upi_id == vpa) | (FlaggedPayee.value == vpa)
        )
        existing = session.exec(query).first()
        if existing:
            existing.report_count += 1
            existing.score = max(existing.score, scam_score)
            if not existing.source_message_text:
                existing.source_message_text = message_text
            session.add(existing)
            flagged_entries.append(existing)
        else:
            entry = FlaggedPayee(
                value=vpa,
                upi_id=vpa,
                kind="vpa",
                source_message_id=message_id,
                source_message_text=message_text,
                score=scam_score,
                reason="Linked to suspicious scam message",
                report_count=1,
                created_at=ts,
            )
            session.add(entry)
            flagged_entries.append(entry)

    # 2. Process extracted URLs
    urls = extract_urls(message_text)
    for url in urls:
        query = select(FlaggedPayee).where(FlaggedPayee.value == url)
        existing = session.exec(query).first()
        if existing:
            existing.report_count += 1
            existing.score = max(existing.score, scam_score)
            session.add(existing)
            flagged_entries.append(existing)
        else:
            entry = FlaggedPayee(
                value=url,
                kind="url",
                source_message_id=message_id,
                source_message_text=message_text,
                score=scam_score,
                reason="Linked to suspicious scam URL",
                report_count=1,
                created_at=ts,
            )
            session.add(entry)
            flagged_entries.append(entry)

    session.commit()
    for e in flagged_entries:
        session.refresh(e)

    return flagged_entries


def detect(
    upi_id: str,
    session: Optional[Session] = None,
    flagged_payees: Optional[list[FlaggedPayee]] = None,
) -> Signal:
    """Check if the scanned UPI ID was linked to a prior scam story.

    Returns:
      - DANGER if UPI ID is in flagged_payees, citing the first 80 characters
        of the message and its date.
      - OK if no prior reports exist.
    """
    clean_upi = upi_id.strip().lower()

    matched: Optional[FlaggedPayee] = None

    if flagged_payees is not None:
        for fp in flagged_payees:
            fp_vpa = (fp.upi_id or fp.value or "").strip().lower()
            if fp_vpa == clean_upi:
                matched = fp
                break
    elif session is not None:
        query = select(FlaggedPayee).where(
            (FlaggedPayee.upi_id == clean_upi) | (FlaggedPayee.value == clean_upi)
        )
        matched = session.exec(query).first()

    if matched is not None:
        # Format date and snippet
        if matched.created_at:
            date_str = matched.created_at.strftime("%Y-%m-%d")
        else:
            date_str = "recent"

        source_text = matched.source_message_text or matched.reason or ""
        snippet = source_text[:80]

        evidence = [
            f"UPI ID matches payee flagged in scam message from {date_str}: \"{snippet}\"",
            f"Flagged report count: {matched.report_count}, confidence: {matched.score:.2f}",
        ]

        return Signal.danger(
            detector=DETECTOR_NAME,
            score=max(0.85, matched.score),
            evidence=evidence,
            explanation_key="flagged_payee_scam_link",
        )

    return Signal.ok(
        detector=DETECTOR_NAME,
        evidence=["Payee has no prior scam reports"],
        explanation_key="story_link_ok",
    )
