"""Tests for qr_parser detector (SPEC Section 6.1).

Validates every row in SPEC Table 6.1 and edge cases:
  - Row 1: upi://pay?pa=ramu.stores@okaxis&pn=Ramu%20Stores&mc=5411 -> valid; fields extracted
  - Row 2: upi://pay?pn=NoAddress -> invalid: missing pa
  - Row 3: https://example.com/pay -> invalid: not a UPI link
  - Row 4: upi://pay?pa=a@b&am=-5 -> valid but flagged: odd amount
  - Row 5: pa with a space inside -> invalid
"""

import pytest

from app.detectors import qr_parser
from app.detectors.qr_parser import detect, parse_qr
from app.signals import Signal


class TestSpecTable61:
    """Test every single row from SPEC Table 6.1."""

    def test_row_1_valid_fields_extracted(self) -> None:
        """Row 1: upi://pay?pa=ramu.stores@okaxis&pn=Ramu%20Stores&mc=5411 -> valid; fields extracted."""
        url = "upi://pay?pa=ramu.stores@okaxis&pn=Ramu%20Stores&mc=5411"
        res = parse_qr(url)

        assert res.is_valid is True
        assert res.payload is not None
        assert res.payload.pa == "ramu.stores@okaxis"
        assert res.payload.pn == "Ramu Stores"
        assert res.payload.mc == "5411"
        assert res.signal.severity == "ok"
        assert res.signal.score == 0.0
        assert res.signal.detector == "qr_parser"

        # Also test detect() direct interface
        sig = detect(url)
        assert isinstance(sig, Signal)
        assert sig.severity == "ok"

    def test_row_2_missing_pa(self) -> None:
        """Row 2: upi://pay?pn=NoAddress -> invalid: missing pa."""
        url = "upi://pay?pn=NoAddress"
        res = parse_qr(url)

        assert res.is_valid is False
        assert res.payload is None
        assert res.signal.severity == "danger"
        assert res.signal.score == 1.0
        assert res.signal.explanation_key == "qr_missing_pa"
        assert any("missing" in e.lower() and "pa" in e.lower() for e in res.signal.evidence)

        sig = detect(url)
        assert sig.severity == "danger"

    def test_row_3_not_a_upi_link(self) -> None:
        """Row 3: https://example.com/pay -> invalid: not a UPI link."""
        url = "https://example.com/pay"
        res = parse_qr(url)

        assert res.is_valid is False
        assert res.payload is None
        assert res.signal.severity == "danger"
        assert res.signal.score == 1.0
        assert res.signal.explanation_key == "qr_not_upi"

        sig = detect(url)
        assert sig.severity == "danger"

    def test_row_4_odd_amount(self) -> None:
        """Row 4: upi://pay?pa=a@b&am=-5 -> valid but flagged: odd amount."""
        url = "upi://pay?pa=a@b&am=-5"
        res = parse_qr(url)

        assert res.is_valid is True
        assert res.payload is not None
        assert res.payload.pa == "a@b"
        assert res.payload.am == -5.0
        assert res.signal.severity == "caution"
        assert res.signal.score > 0.0
        assert res.signal.explanation_key == "qr_odd_amount"
        assert any("amount" in e.lower() for e in res.signal.evidence)

        sig = detect(url)
        assert sig.severity == "caution"

    def test_row_5_pa_with_space_inside(self) -> None:
        """Row 5: pa with a space inside -> invalid."""
        # Test both raw string with space and UPI URI with space in pa
        url_with_space = "upi://pay?pa=ramu stores@okaxis"
        res = parse_qr(url_with_space)
        assert res.is_valid is False
        assert res.signal.severity == "danger"

        raw_space = "pa with a space inside"
        res2 = parse_qr(raw_space)
        assert res2.is_valid is False
        assert res2.signal.severity == "danger"


class TestQREdgeCases:
    """Additional edge cases for QR parser."""

    def test_empty_string(self) -> None:
        res = parse_qr("")
        assert res.is_valid is False
        assert res.signal.severity == "danger"

    def test_none_input(self) -> None:
        res = parse_qr(None)  # type: ignore
        assert res.is_valid is False
        assert res.signal.severity == "danger"

    def test_pn_never_treated_as_identity(self) -> None:
        """SPEC Section 6.1: pn field is typed by maker, never treat as identity proof."""
        url = "upi://pay?pa=fraudster@okaxis&pn=State%20Bank%20Of%20India"
        res = parse_qr(url)
        assert res.is_valid is True
        # pn is extracted but evidence includes warning
        assert any("never treated as identity proof" in e for e in res.signal.evidence)

    def test_optional_transaction_note(self) -> None:
        url = "upi://pay?pa=shop@okaxis&tn=Vegetables%20payment"
        res = parse_qr(url)
        assert res.is_valid is True
        assert res.payload.tn == "Vegetables payment"

    def test_zero_amount_flagged_as_odd(self) -> None:
        url = "upi://pay?pa=shop@okaxis&am=0"
        res = parse_qr(url)
        assert res.is_valid is True
        assert res.signal.severity == "caution"

    def test_positive_valid_amount(self) -> None:
        url = "upi://pay?pa=shop@okaxis&am=150.50"
        res = parse_qr(url)
        assert res.is_valid is True
        assert res.payload.am == 150.50
        assert res.signal.severity == "ok"
