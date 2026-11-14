"""Tests for OCR and QR image processing detector (SPEC Section 6.7).

Verifies:
  - QR images decoded via OpenCV headless first (before attempting OCR).
  - Normal screenshots / text images processed with Tesseract (with graceful missing binary fallback).
  - Empty, blank, or low-confidence images return a prompt-to-paste error.
  - End-to-end image processing via process_image() and detect().
"""

import io
from pathlib import Path
from unittest.mock import patch

import cv2
import numpy as np
from PIL import Image, ImageDraw
import pytest

from app.detectors.ocr import decode_qr, detect, extract_text, process_image


# ---------------------------------------------------------------------------
# Helpers to generate synthetic test images in-memory
# ---------------------------------------------------------------------------

def _make_qr_image_bytes(payload: str = "upi://pay?pa=ramu@okaxis&pn=RamuStore") -> bytes:
    """Generate a clean QR code PNG image in bytes using OpenCV encoder."""
    enc = cv2.QRCodeEncoder.create()
    matrix = enc.encode(payload)
    # Scale up for reliable detection
    scaled = cv2.resize(matrix, (300, 300), interpolation=cv2.INTER_NEAREST)
    # Add quiet zone border (40px white)
    padded = cv2.copyMakeBorder(scaled, 40, 40, 40, 40, cv2.BORDER_CONSTANT, value=255)
    success, buffer = cv2.imencode(".png", padded)
    assert success
    return buffer.tobytes()


def _make_text_image_bytes(text: str = "Your KYC expires today.") -> bytes:
    """Generate an image containing rendered text in bytes."""
    img = Image.new("RGB", (400, 100), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((20, 35), text, fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _make_blank_image_bytes() -> bytes:
    """Generate a blank white image in bytes."""
    blank = np.full((200, 200, 3), 255, dtype=np.uint8)
    success, buffer = cv2.imencode(".png", blank)
    assert success
    return buffer.tobytes()


# ---------------------------------------------------------------------------
# 1. QR Code Decoding Tests
# ---------------------------------------------------------------------------

class TestQRCodeDecoding:
    """Verify OpenCV headless decodes QR codes before OCR."""

    def test_decode_valid_qr_image(self) -> None:
        """A valid QR code image returns its decoded UPI payload."""
        payload = "upi://pay?pa=store@okaxis&pn=AlphaStore&am=150.00"
        img_bytes = _make_qr_image_bytes(payload)

        decoded = decode_qr(img_bytes)
        assert decoded == payload

    def test_decode_qr_numpy_array(self) -> None:
        """decode_qr accepts a numpy image array directly."""
        payload = "upi://pay?pa=shop42@okaxis"
        img_bytes = _make_qr_image_bytes(payload)
        arr = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)

        decoded = decode_qr(arr)
        assert decoded == payload

    def test_decode_non_qr_returns_none(self) -> None:
        """A blank image returns None when decoded as QR."""
        blank_bytes = _make_blank_image_bytes()
        assert decode_qr(blank_bytes) is None

    def test_corrupted_image_returns_none(self) -> None:
        """Corrupted or invalid bytes return None safely without crashing."""
        assert decode_qr(b"not-an-image-data-corrupted") is None


# ---------------------------------------------------------------------------
# 2. Image Processing & OCR Pipeline Tests
# ---------------------------------------------------------------------------

class TestProcessImagePipeline:
    """Verify process_image prioritizes QR, runs OCR, and handles low confidence."""

    def test_qr_image_detected_as_type_qr(self) -> None:
        """Images containing a QR code are classified with type 'qr'."""
        payload = "upi://pay?pa=payment@okaxis"
        img_bytes = _make_qr_image_bytes(payload)

        result = process_image(img_bytes)
        assert result["type"] == "qr"
        assert result["payload"] == payload
        assert result["error"] is None

        # Verify Signal output
        sig = detect(img_bytes)
        assert sig.severity == "ok"
        assert sig.explanation_key == "ocr_qr_decoded"
        assert payload in sig.evidence[0]

    def test_blank_image_prompts_to_paste_text(self) -> None:
        """An empty or blank image returns an error asking user to paste text."""
        blank_bytes = _make_blank_image_bytes()

        result = process_image(blank_bytes)
        assert result["type"] == "text"
        assert result["payload"] is None
        assert result["error"] is not None
        assert "paste" in result["error"].lower()

        # Verify Signal output is caution with prompt
        sig = detect(blank_bytes)
        assert sig.severity == "caution"
        assert sig.explanation_key == "ocr_low_confidence"

    def test_ocr_mock_text_extraction(self) -> None:
        """Test OCR text extraction pipeline with simulated Tesseract output."""
        img_bytes = _make_text_image_bytes("Your KYC expires today.")

        mock_data = {
            "text": ["Your", "KYC", "expires", "today."],
            "conf": ["92", "95", "90", "96"],
        }
        with patch("pytesseract.image_to_data", return_value=mock_data):
            text, conf = extract_text(img_bytes)
            assert "Your KYC expires today." in text
            assert conf > 90.0

            result = process_image(img_bytes)
            assert result["type"] == "text"
            assert result["error"] is None
            assert result["text"] == "Your KYC expires today."

            sig = detect(img_bytes)
            assert sig.severity == "ok"
            assert sig.explanation_key == "ocr_text_extracted"

    def test_missing_tesseract_handled_gracefully(self) -> None:
        """If Tesseract is not installed on the system, it returns empty without crashing."""
        img_bytes = _make_blank_image_bytes()
        with patch("pytesseract.image_to_data", side_effect=Exception("Tesseract not found")):
            text, conf = extract_text(img_bytes)
            assert text == ""
            assert conf == 0.0

            result = process_image(img_bytes)
            assert result["error"] is not None
            assert "paste" in result["error"].lower()
