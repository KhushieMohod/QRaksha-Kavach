"""Tests for scam_text detector and LLM integration (SPEC Sections 3, 5, 6.5).

Verifies:
  - Every single row in SPEC Table 6.5.
  - Multi-pattern weight combination: 1 - product(1 - weight_i).
  - Negation suppression within 6 words.
  - LLM offline fallback (LLM_OFFLINE=1).
  - SQLite llm_cache lookup and cache hits.
  - LLM span validation (invalid spans discarded).
  - Evaluation on 20 held-out messages, printing accuracy, precision, recall, and FPR.
"""

from datetime import datetime, timezone
import json
import os
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from sqlmodel import Session, SQLModel, create_engine, select

from app.config.loader import clear_config_cache
from app.detectors.scam_text import detect, rule_layer_score
from app.llm import (
    _prompt_hash,
    build_scam_analysis_prompt,
    call_llm,
    get_cached_response,
    store_cached_response,
)
from app.models import LLMCache


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def clean_config():
    """Ensure fresh configuration cache for every test."""
    clear_config_cache()
    yield
    clear_config_cache()


@pytest.fixture(name="engine")
def fixture_engine(tmp_path: Path):
    """Create a temporary SQLite engine."""
    db_file = tmp_path / "test_llm.db"
    engine = create_engine(f"sqlite:///{db_file}", echo=False)
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture(name="session")
def fixture_session(engine):
    """Yield a database session bound to the temporary engine."""
    with Session(engine) as session:
        yield session


# ---------------------------------------------------------------------------
# 1. SPEC Section 6.5 Table Tests
# ---------------------------------------------------------------------------

class TestSpecTable65:
    """Test every row in SPEC Table 6.5."""

    def test_row_1_kyc_and_apk_install(self) -> None:
        """'Your KYC expires today. Install KYC_Update.apk now' -> danger."""
        text = "Your KYC expires today. Install KYC_Update.apk now"
        sig = detect(text)
        assert sig.severity == "danger"
        assert sig.score >= 0.80
        assert sig.detector == "scam_text"

    def test_row_2_never_share_otp(self) -> None:
        """'Never share your OTP with anyone.' -> not flagged (ok)."""
        text = "Never share your OTP with anyone."
        sig = detect(text)
        assert sig.severity == "ok"
        assert sig.score < 0.50

    def test_row_3_otp_notification_do_not_share(self) -> None:
        """'Your OTP is 482913. Valid for 10 minutes. Do not share.' -> not flagged (ok)."""
        text = "Your OTP is 482913. Valid for 10 minutes. Do not share."
        sig = detect(text)
        assert sig.severity == "ok"
        assert sig.score < 0.50

    def test_row_4_cbi_digital_arrest(self) -> None:
        """'This is CBI. You are under digital arrest. Transfer Rs 50,000 to verify.' -> danger."""
        text = "This is CBI. You are under digital arrest. Transfer Rs 50,000 to verify."
        sig = detect(text)
        assert sig.severity == "danger"
        assert sig.score >= 0.80

    def test_row_5_scan_qr_to_receive_refund(self) -> None:
        """'Scan this QR to receive your Rs 5,000 refund' -> danger."""
        text = "Scan this QR to receive your Rs 5,000 refund"
        sig = detect(text)
        assert sig.severity == "danger"
        assert sig.score >= 0.80

    def test_row_6_innocent_family_message(self) -> None:
        """'Amma, I reached home. Call you later.' -> not flagged (ok)."""
        text = "Amma, I reached home. Call you later."
        sig = detect(text)
        assert sig.severity == "ok"
        assert sig.score == 0.0

    def test_row_7_advisory_about_challan_apks(self) -> None:
        """'An advisory warning people about fake challan APKs' -> caution at most."""
        text = "An advisory warning people about fake challan APKs"
        sig = detect(text)
        # Spec constraint: caution at most (known hard case) — cannot be danger
        assert sig.severity in ("ok", "caution")
        assert sig.severity != "danger"


# ---------------------------------------------------------------------------
# 2. Rule Layer & Negation Tests
# ---------------------------------------------------------------------------

class TestRuleLayerAndNegation:
    """Verify weight formula and negation window logic."""

    def test_weight_combination_formula(self) -> None:
        """Combining weights w1=0.7 and w2=0.5 must yield 1 - (1-0.7)*(1-0.5) = 0.85."""
        text = "Scan this QR to receive your Rs 5,000 refund"
        score, cats, ev = rule_layer_score(text)
        # scan_to_receive (0.7) and prize_refund (0.5)
        expected = 1.0 - (1.0 - 0.7) * (1.0 - 0.5)  # 0.85
        assert score == pytest.approx(expected, abs=0.01)

    def test_negation_within_six_words(self) -> None:
        """Negation within 6 words suppresses the matched pattern."""
        # 3 words between 'never share' and 'PIN'
        text = "Please never share your secret PIN with anyone."
        score, cats, ev = rule_layer_score(text)
        assert score == 0.0
        assert "otp_pin_request" not in cats

    def test_distant_negation_does_not_suppress(self) -> None:
        """Negation phrase more than 6 words away does NOT suppress pattern."""
        # 8 words between 'do not share' and 'transfer rs 5000'
        text = "Do not share passwords. But you must absolutely quickly go ahead and transfer Rs 5,000 immediately."
        score, cats, ev = rule_layer_score(text)
        assert "payment_demand" in cats
        assert score >= 0.40


# ---------------------------------------------------------------------------
# 3. LLM Integration, Offline Mode, & Caching Tests
# ---------------------------------------------------------------------------

class TestLLMIntegrationAndCache:
    """Verify LLM caching, offline fallback, and span validation."""

    def test_offline_mode_returns_none(self, monkeypatch) -> None:
        """With LLM_OFFLINE=1, call_llm returns None immediately."""
        monkeypatch.setenv("LLM_OFFLINE", "1")
        prompt = build_scam_analysis_prompt("Test message")
        result = call_llm(prompt)
        assert result is None

    def test_offline_mode_detector_uses_rules_only(self, monkeypatch) -> None:
        """With LLM_OFFLINE=1, detect() continues functioning on deterministic rules."""
        monkeypatch.setenv("LLM_OFFLINE", "1")
        sig = detect("Your KYC expires today. Install KYC_Update.apk now")
        assert sig.severity == "danger"
        assert sig.score >= 0.80

    def test_llm_cache_storage_and_hit(self, session: Session) -> None:
        """Cached LLM responses hit the SQLite table and avoid repeated processing."""
        prompt = "Is this text a scam?"
        fake_response = json.dumps({
            "score": 0.95,
            "labels": ["kyc_update"],
            "spans": ["fake prompt text"],
        })

        # Initially not in cache
        assert get_cached_response(session, prompt) is None

        # Store in cache
        store_cached_response(session, prompt, fake_response, model_name="test-model")

        # Now cache lookup returns the stored JSON
        cached = get_cached_response(session, prompt)
        assert cached == fake_response

        # Verify entry in LLMCache table
        h = _prompt_hash(prompt)
        entry = session.exec(select(LLMCache).where(LLMCache.prompt_hash == h)).first()
        assert entry is not None
        assert entry.model_name == "test-model"

    def test_invalid_llm_spans_discarded(self, monkeypatch) -> None:
        """LLM response with spans NOT in the input text is discarded."""
        # Mock call_llm returning hallucinated spans
        hallucinated_response = {
            "score": 0.99,
            "labels": ["digital_arrest"],
            "spans": ["nonexistent text never said in original message"],
        }
        monkeypatch.setattr("app.detectors.scam_text.call_llm", lambda *a, **kw: hallucinated_response)
        monkeypatch.setenv("LLM_OFFLINE", "0")

        # Input message has no rule matches
        text = "Hello friend, see you at the library."
        sig = detect(text)
        # Hallucinated LLM response should be discarded => severity ok
        assert sig.severity == "ok"
        assert sig.score == 0.0

    def test_valid_llm_spans_accepted(self, monkeypatch) -> None:
        """LLM response with exact substring spans is accepted and fused."""
        text = "Transfer the fee to unblock your account"
        valid_response = {
            "score": 0.85,
            "labels": ["payment_demand"],
            "spans": ["Transfer the fee"],
        }
        monkeypatch.setattr("app.detectors.scam_text.call_llm", lambda *a, **kw: valid_response)
        monkeypatch.setenv("LLM_OFFLINE", "0")

        sig = detect(text)
        assert sig.severity == "danger"
        assert sig.score >= 0.85
        assert any("LLM identified spans" in ev for ev in sig.evidence)


# ---------------------------------------------------------------------------
# 4. Evaluation on Held-Out Set (SPEC Section 6.5 Requirement)
# ---------------------------------------------------------------------------

class TestHeldOutDatasetEvaluation:
    """Evaluate detector on the 20 held-out messages and print metrics."""

    def test_held_out_metrics_evaluation(self, capsys) -> None:
        """Evaluate accuracy, precision, recall, and false-positive rate on held-out set."""
        dataset_path = Path(__file__).resolve().parents[2] / "data" / "messages_labelled.json"
        with open(dataset_path, "r", encoding="utf-8") as fh:
            dataset = json.load(fh)

        held_out = dataset["held_out"]
        assert len(held_out) == 20, "Held-out set must have exactly 20 messages"

        tp = fp = tn = fn = 0
        for item in held_out:
            sig = detect(item["text"])
            is_scam_pred = sig.severity in ("danger", "caution")
            is_scam_actual = (item["label"] == "scam")

            if is_scam_actual and is_scam_pred:
                tp += 1
            elif not is_scam_actual and is_scam_pred:
                fp += 1
            elif not is_scam_actual and not is_scam_pred:
                tn += 1
            elif is_scam_actual and not is_scam_pred:
                fn += 1

        total = len(held_out)
        accuracy = (tp + tn) / total
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0

        # Print metrics as required by SPEC Section 6.5
        print("\n================ HELD-OUT EVALUATION METRICS ================")
        print(f"Total samples:     {total}")
        print(f"True Positives:    {tp}")
        print(f"False Positives:   {fp}")
        print(f"True Negatives:    {tn}")
        print(f"False Negatives:   {fn}")
        print(f"Accuracy:          {accuracy * 100:.2f}%")
        print(f"Precision:         {precision * 100:.2f}%")
        print(f"Recall:            {recall * 100:.2f}%")
        print(f"False Positive Rt: {fpr * 100:.2f}%")
        print("=============================================================")

        # Assert minimum performance bounds
        assert accuracy >= 0.85, f"Held-out accuracy too low: {accuracy}"
        assert precision >= 0.85, f"Held-out precision too low: {precision}"
        assert recall >= 0.80, f"Held-out recall too low: {recall}"
        assert fpr <= 0.15, f"Held-out false positive rate too high: {fpr}"
