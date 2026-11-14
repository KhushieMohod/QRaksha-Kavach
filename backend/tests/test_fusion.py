"""Tests for verdict fusion engine (SPEC Section 7).

Verifies the four fusion rules in strict priority order:
  1. Any danger signal gives DANGER (hard rules are not averaged away).
  2. Else any caution signal gives CAUTION.
  3. Else if registry_binding matches registry, gives VERIFIED.
  4. Else gives UNVERIFIED (with specific text for text check).
  5. Response lists every non-ok reason.
  6. Explanation and next_steps selected from explanations.yaml by strongest reason key.
  7. Explanation includes en, te, hi languages.
"""

import pytest

from app.config.loader import clear_config_cache
from app.fusion import fuse_signals
from app.signals import Signal


@pytest.fixture(autouse=True)
def clean_config():
    """Ensure clean configuration cache."""
    clear_config_cache()
    yield
    clear_config_cache()


class TestFusionRulesHierarchy:
    """Verify the 4 rules in strict order (SPEC Section 7)."""

    def test_rule_1_any_danger_gives_danger(self) -> None:
        """Rule 1: Any danger signal produces DANGER even if other signals are OK."""
        signals = [
            Signal.ok(detector="qr_parser", evidence=["Valid UPI link"]),
            Signal.danger(
                detector="registry_binding",
                score=0.95,
                evidence=["QR payee differs from registered payee for shop KIR-0001"],
                explanation_key="payee_not_registered_here",
            ),
            Signal.ok(detector="story_link", evidence=["No prior reports"]),
        ]

        fused = fuse_signals(signals, check_type="qr")
        assert fused.verdict == "DANGER"
        assert len(fused.reasons) == 1
        assert fused.reasons[0].detector == "registry_binding"
        assert fused.explanation.en is not None
        assert "differs" in fused.explanation.en
        assert "Do not pay" in fused.next_steps

    def test_rule_1_multiple_dangers_picks_strongest_explanation(self) -> None:
        """Rule 1: When multiple danger signals occur, the highest scoring key is used."""
        signals = [
            Signal.danger(
                detector="handle_lookalike",
                score=0.90,
                evidence=["Typo suffix"],
                explanation_key="lookalike_suffix_typo",
            ),
            Signal.danger(
                detector="story_link",
                score=0.98,
                evidence=["Linked to digital arrest scam"],
                explanation_key="flagged_payee_scam_link",
            ),
        ]

        fused = fuse_signals(signals, check_type="qr")
        assert fused.verdict == "DANGER"
        # Both non-ok reasons listed
        assert len(fused.reasons) == 2
        # Strongest key (0.98 > 0.90) used for explanation
        assert "reported in a scam message" in fused.explanation.en.lower()

    def test_rule_2_caution_gives_caution_when_no_danger(self) -> None:
        """Rule 2: Any caution signal gives CAUTION if no danger signals exist."""
        signals = [
            Signal.ok(detector="qr_parser", evidence=["Valid link"]),
            Signal.caution(
                detector="crowd_baseline",
                score=0.60,
                evidence=["Payee here changed recently"],
                explanation_key="payee_changed_recently",
            ),
            Signal.ok(detector="story_link", evidence=["No reports"]),
        ]

        fused = fuse_signals(signals, check_type="qr")
        assert fused.verdict == "CAUTION"
        assert len(fused.reasons) == 1
        assert fused.reasons[0].detector == "crowd_baseline"
        assert "recently" in fused.explanation.en.lower()

    def test_rule_3_matches_registry_gives_verified(self) -> None:
        """Rule 3: If no danger and no caution, and registry matches -> VERIFIED."""
        signals = [
            Signal.ok(detector="qr_parser", evidence=["Valid link"]),
            Signal.ok(
                detector="registry_binding",
                evidence=["matches registry"],
                explanation_key="matches_registry",
            ),
            Signal.ok(detector="story_link", evidence=["No reports"]),
        ]

        fused = fuse_signals(signals, check_type="qr")
        assert fused.verdict == "VERIFIED"
        assert len(fused.reasons) == 0  # No non-ok reasons
        assert "verified" in fused.explanation.en.lower()
        assert any("PIN" in step for step in fused.next_steps)

    def test_rule_4_unverified_when_no_registry_match(self) -> None:
        """Rule 4: If no danger, no caution, and no registry match -> UNVERIFIED."""
        signals = [
            Signal.ok(detector="qr_parser", evidence=["Valid link"]),
            Signal.ok(
                detector="registry_binding",
                evidence=["no registry data"],
                explanation_key="no_registry_data",
            ),
            Signal.ok(detector="story_link", evidence=["No reports"]),
        ]

        fused = fuse_signals(signals, check_type="qr")
        assert fused.verdict == "UNVERIFIED"
        assert len(fused.reasons) == 0
        assert "no registered" in fused.explanation.en.lower()

    def test_rule_4_text_check_unverified_specific_message(self) -> None:
        """Rule 4: Text check with no scam signs shows 'No scam signs found. This is not a guarantee.'"""
        signals = [
            Signal.ok(
                detector="scam_text",
                evidence=["No scam patterns detected"],
                explanation_key="scam_text_ok",
            )
        ]

        fused = fuse_signals(signals, check_type="text")
        assert fused.verdict == "UNVERIFIED"
        # SPEC Section 7.4 exact sentence
        assert "No scam signs found. This is not a guarantee." in fused.explanation.en

    def test_multilingual_explanation_keys_present(self) -> None:
        """All verdicts return en, te, hi explanation strings."""
        signals = [
            Signal.ok(
                detector="registry_binding",
                evidence=["matches registry"],
                explanation_key="matches_registry",
            )
        ]
        fused = fuse_signals(signals, check_type="qr")
        assert fused.explanation.en is not None and len(fused.explanation.en) > 0
        assert fused.explanation.te is not None and len(fused.explanation.te) > 0
        assert fused.explanation.hi is not None and len(fused.explanation.hi) > 0
