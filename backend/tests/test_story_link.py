"""Tests for story_link detector (SPEC Section 6.6).

Verifies:
  - Extraction of UPI IDs (letters, digits, dots, hyphens, underscores, then @, then letters) and web links.
  - Messages with score >= scam_caution (0.5) persist flagged payees to database.
  - Messages with score < scam_caution do not persist payees.
  - Subsequent payment / QR check with a flagged UPI ID returns DANGER citing
    the first 80 characters of the source message and its date.
  - Deduplication and report_count incrementing on repeated reports.
  - End-to-end integration flow from scam message to QR detection.
"""

from datetime import datetime, timezone
from pathlib import Path

import pytest
from sqlmodel import Session, SQLModel, create_engine, select

from app.detectors.scam_text import detect as detect_scam_text
from app.detectors.story_link import (
    detect,
    extract_upi_ids,
    extract_urls,
    link_message_payees,
)
from app.models import FlaggedPayee


@pytest.fixture(name="engine")
def fixture_engine(tmp_path: Path):
    """Create a temporary SQLite engine."""
    db_file = tmp_path / "test_story_link.db"
    engine = create_engine(f"sqlite:///{db_file}", echo=False)
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture(name="session")
def fixture_session(engine):
    """Yield a database session bound to the temporary engine."""
    with Session(engine) as session:
        yield session


# ---------------------------------------------------------------------------
# 1. Extraction Unit Tests
# ---------------------------------------------------------------------------

class TestExtractionUtilities:
    """Verify regex extraction of UPI IDs and URLs."""

    def test_extract_upi_ids_various_formats(self) -> None:
        """Extract valid UPI VPAs with dots, hyphens, digits, underscores."""
        text = (
            "Transfer Rs 1000 to ramu.store-01_pay@okaxis immediately. "
            "Also backup at cbi_cyber@ybl. Do not pay to invalid-vpa."
        )
        upis = extract_upi_ids(text)
        assert "ramu.store-01_pay@okaxis" in upis
        assert "cbi_cyber@ybl" in upis
        assert len(upis) == 2

    def test_extract_upi_ids_cleans_trailing_punctuation(self) -> None:
        """Trailing dots, commas, question marks are stripped from UPI IDs."""
        text = "Send money to fraudster@okaxis, or scammer@ybl."
        upis = extract_upi_ids(text)
        assert "fraudster@okaxis" in upis
        assert "scammer@ybl" in upis

    def test_extract_urls_handles_protocols_and_shorteners(self) -> None:
        """Extract standard URLs and common shortener domains."""
        text = (
            "Verify your KYC at https://sbi-verification.fake.com/update "
            "or click bit.ly/sbi-urgent or tinyurl.com/kyc-now."
        )
        urls = extract_urls(text)
        assert "https://sbi-verification.fake.com/update" in urls
        assert "bit.ly/sbi-urgent" in urls
        assert "tinyurl.com/kyc-now" in urls
        assert len(urls) == 3


# ---------------------------------------------------------------------------
# 2. Persistence & Linking Tests
# ---------------------------------------------------------------------------

class TestPayeeLinkingLogic:
    """Verify persisting to flagged_payees conditioned on scam score."""

    def test_score_below_scam_caution_not_saved(self, session: Session) -> None:
        """A message scoring below scam_caution (0.5) does not save to flagged_payees."""
        text = "Hey friend, please send Rs 200 for lunch to friend@okaxis."
        flagged = link_message_payees(session, message_text=text, scam_score=0.20)
        assert len(flagged) == 0

        # DB must remain empty
        entries = session.exec(select(FlaggedPayee)).all()
        assert len(entries) == 0

    def test_score_at_or_above_scam_caution_saves_payees(self, session: Session) -> None:
        """A scam message scoring >= 0.5 saves extracted UPI IDs and URLs."""
        text = "Digital arrest warrant issued. Transfer Rs 50,000 to cyber_cbi@ybl at bit.ly/cbi-pay"
        msg_date = datetime(2026, 11, 12, 10, 30, tzinfo=timezone.utc)

        flagged = link_message_payees(
            session=session,
            message_text=text,
            scam_score=0.92,
            message_id=101,
            message_date=msg_date,
        )

        assert len(flagged) == 2  # 1 UPI + 1 URL
        vpa_entries = [f for f in flagged if f.kind == "vpa"]
        assert len(vpa_entries) == 1
        assert vpa_entries[0].upi_id == "cyber_cbi@ybl"
        assert vpa_entries[0].score == 0.92
        assert vpa_entries[0].source_message_id == 101

    def test_repeated_report_increments_count_and_updates_score(
        self, session: Session
    ) -> None:
        """Reporting the same UPI ID again increments report_count."""
        text1 = "Send money to repeat_scam@okaxis now."
        link_message_payees(session, text1, scam_score=0.60)

        # Second scam message mentioning the same UPI ID with higher score
        text2 = "Urgent: Your account blocked. Transfer immediately to repeat_scam@okaxis"
        link_message_payees(session, text2, scam_score=0.85)

        entry = session.exec(
            select(FlaggedPayee).where(FlaggedPayee.upi_id == "repeat_scam@okaxis")
        ).first()

        assert entry is not None
        assert entry.report_count == 2
        assert entry.score == 0.85


# ---------------------------------------------------------------------------
# 3. Detection & Citation Tests (SPEC Section 6.6)
# ---------------------------------------------------------------------------

class TestStoryLinkDetection:
    """Verify QR check against flagged_payees returns danger citing message and date."""

    def test_unflagged_payee_returns_ok(self, session: Session) -> None:
        """A clean payee with no scam reports returns ok."""
        sig = detect("honest_merchant@okaxis", session=session)
        assert sig.severity == "ok"
        assert sig.explanation_key == "story_link_ok"

    def test_flagged_payee_returns_danger_with_citation(self, session: Session) -> None:
        """A flagged payee returns danger quoting first 80 chars of message and date."""
        scam_story = (
            "This is CBI Cyber Cell. An arrest warrant has been issued in your name. "
            "You must transfer the bail verification deposit immediately."
        )
        flag_date = datetime(2026, 11, 10, 14, 0, tzinfo=timezone.utc)

        fp = FlaggedPayee(
            value="cbi.bail@ybl",
            upi_id="cbi.bail@ybl",
            kind="vpa",
            source_message_text=scam_story,
            score=0.95,
            created_at=flag_date,
        )
        session.add(fp)
        session.commit()

        # Run detection
        sig = detect("cbi.bail@ybl", session=session)
        assert sig.severity == "danger"
        assert sig.score >= 0.95
        assert sig.explanation_key == "flagged_payee_scam_link"

        # Verify citation contains date (2026-11-10) and first 80 chars
        evidence_text = " ".join(sig.evidence)
        assert "2026-11-10" in evidence_text
        assert scam_story[:80] in evidence_text

    def test_case_insensitive_matching(self, session: Session) -> None:
        """Matching against flagged_payees must be case-insensitive."""
        fp = FlaggedPayee(
            value="scam.merchant@okaxis",
            upi_id="scam.merchant@okaxis",
            kind="vpa",
            source_message_text="Fake prize refund. Pay processing fee.",
            score=0.88,
        )
        session.add(fp)
        session.commit()

        sig = detect("SCAM.MERCHANT@OKAXIS", session=session)
        assert sig.severity == "danger"


# ---------------------------------------------------------------------------
# 4. Acceptance End-to-End Test
# ---------------------------------------------------------------------------

class TestStoryLinkEndToEndAcceptance:
    """Acceptance test: scam message with UPI ID flags payee; later QR check returns danger."""

    def test_message_to_qr_check_flow(self, session: Session) -> None:
        """Full end-to-end pipeline:
        1. User submits a scam message citing a UPI ID.
        2. scam_text detector evaluates the message as dangerous.
        3. story_link.link_message_payees stores the extracted UPI ID in flagged_payees.
        4. Later, a QR check with that UPI ID triggers story_link detector.
        5. story_link returns DANGER quoting the source message.
        """
        message_text = (
            "This is CBI. You are under digital arrest. "
            "Transfer Rs 50,000 to verify your bank account to cbi.verify@ybl now."
        )

        # 1. Run scam_text detector on the message
        scam_sig = detect_scam_text(message_text, session=session)
        assert scam_sig.severity == "danger"
        assert scam_sig.score >= 0.80

        # 2. Link payees from the scored message
        msg_date = datetime(2026, 11, 14, 12, 0, tzinfo=timezone.utc)
        flagged_list = link_message_payees(
            session=session,
            message_text=message_text,
            scam_score=scam_sig.score,
            message_date=msg_date,
        )
        assert any(f.upi_id == "cbi.verify@ybl" for f in flagged_list)

        # 3. Later, user scans a QR with that UPI ID
        scanned_upi = "cbi.verify@ybl"
        qr_sig = detect(scanned_upi, session=session)

        # 4. Assert danger with message citation
        assert qr_sig.severity == "danger"
        assert qr_sig.score >= 0.80
        assert "2026-11-14" in qr_sig.evidence[0]
        assert "This is CBI. You are under digital arrest." in qr_sig.evidence[0]
