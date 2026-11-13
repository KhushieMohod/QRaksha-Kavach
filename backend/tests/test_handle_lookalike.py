"""Tests for handle_lookalike detector (SPEC Section 6.2).

Validates every single row from SPEC Table 6.2 and edge cases:
  - Row 1: ramu.stores@okaxis -> ok
  - Row 2: sbi.support@oksbi -> danger (brand plus support word)
  - Row 3: refund.kyc@oksbl -> danger (suffix one letter from oksbi)
  - Row 4: shop123@xyzbank -> caution (unknown suffix)
  - Row 5: npci-help@ybl -> danger (brand plus support word)
"""

import pytest

from app.config.loader import load_rules, load_thresholds
from app.detectors import handle_lookalike
from app.detectors.handle_lookalike import detect
from app.signals import Signal


class TestSpecTable62:
    """Test every single row from SPEC Table 6.2."""

    def test_row_1_ramu_stores_okaxis(self) -> None:
        """Row 1: ramu.stores@okaxis -> ok."""
        sig = detect("ramu.stores@okaxis")
        assert isinstance(sig, Signal)
        assert sig.detector == "handle_lookalike"
        assert sig.severity == "ok"
        assert sig.score == 0.0

    def test_row_2_sbi_support_oksbi(self) -> None:
        """Row 2: sbi.support@oksbi -> danger (brand plus support word)."""
        sig = detect("sbi.support@oksbi")
        assert isinstance(sig, Signal)
        assert sig.detector == "handle_lookalike"
        assert sig.severity == "danger"
        assert sig.score >= 0.8
        assert sig.explanation_key == "lookalike_brand_support"
        assert any("sbi" in e.lower() and "support" in e.lower() for e in sig.evidence)

    def test_row_3_refund_kyc_oksbl(self) -> None:
        """Row 3: refund.kyc@oksbl -> danger (suffix one letter from oksbi)."""
        sig = detect("refund.kyc@oksbl")
        assert isinstance(sig, Signal)
        assert sig.detector == "handle_lookalike"
        assert sig.severity == "danger"
        assert sig.score >= 0.8
        # Suffix oksbl is 1 edit from oksbi
        assert sig.explanation_key in ("lookalike_suffix_typo", "lookalike_brand_support")
        assert any("oksbl" in e.lower() or "edit away" in e.lower() for e in sig.evidence)

    def test_row_4_shop123_xyzbank(self) -> None:
        """Row 4: shop123@xyzbank -> caution (unknown suffix)."""
        sig = detect("shop123@xyzbank")
        assert isinstance(sig, Signal)
        assert sig.detector == "handle_lookalike"
        assert sig.severity == "caution"
        assert 0.0 < sig.score < 0.8
        assert sig.explanation_key == "unknown_handle_suffix"
        assert any("xyzbank" in e.lower() for e in sig.evidence)

    def test_row_5_npci_help_ybl(self) -> None:
        """Row 5: npci-help@ybl -> danger (brand npci plus support help)."""
        sig = detect("npci-help@ybl")
        assert isinstance(sig, Signal)
        assert sig.detector == "handle_lookalike"
        assert sig.severity == "danger"
        assert sig.score >= 0.8
        assert sig.explanation_key == "lookalike_brand_support"
        assert any("npci" in e.lower() and "help" in e.lower() for e in sig.evidence)


class TestLookalikeEdgeCases:
    """Edge cases for handle lookalike detector."""

    def test_digit_swapped_for_letters_brand_caution(self) -> None:
        """SPEC Section 6.2: Caution if digits are swapped for letters in a brand word."""
        # 'sb1' has digit 1 swapped for letter i (sbi)
        sig = detect("sb1.customer@okaxis")
        assert sig.severity == "caution"
        assert sig.explanation_key == "lookalike_digit_swap"
        assert any("sb1" in e.lower() for e in sig.evidence)

    def test_digit_swap_p4ytm(self) -> None:
        """Digit 4 swapped for 'a' in paytm."""
        sig = detect("p4ytm.billing@okaxis")
        assert sig.severity == "caution"
        assert sig.explanation_key == "lookalike_digit_swap"

    def test_empty_upi_id(self) -> None:
        sig = detect("")
        assert sig.severity == "danger"

    def test_missing_at_symbol(self) -> None:
        sig = detect("invalid_upi_without_at")
        assert sig.severity == "danger"

    def test_multiple_at_symbols(self) -> None:
        sig = detect("foo@bar@okaxis")
        assert sig.severity == "danger"

    def test_case_insensitivity(self) -> None:
        """Lookalike checks should be case-insensitive."""
        sig1 = detect("RAMU.STORES@OKAXIS")
        assert sig1.severity == "ok"

        sig2 = detect("SBI.SUPPORT@OKSBI")
        assert sig2.severity == "danger"


class TestConfigDrivenIntegrity:
    """Verify that all detection thresholds and rules come from YAML configs."""

    def test_suffixes_loaded_from_yaml(self) -> None:
        rules = load_rules()
        suffixes = rules.get("known_handle_suffixes", [])
        assert "okaxis" in suffixes
        assert "oksbi" in suffixes
        assert "ybl" in suffixes

    def test_brand_words_loaded_from_yaml(self) -> None:
        rules = load_rules()
        brands = rules.get("brand_words", [])
        assert "sbi" in brands
        assert "npci" in brands

    def test_support_words_loaded_from_yaml(self) -> None:
        rules = load_rules()
        supports = rules.get("support_words", [])
        assert "support" in supports
        assert "help" in supports

    def test_thresholds_loaded_from_yaml(self) -> None:
        thresh = load_thresholds()
        assert thresh.get("lookalike_suffix_edit_distance") == 1
