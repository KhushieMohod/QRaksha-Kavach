"""OCR and QR Image Processing Detector (SPEC Section 6.7).

Processes uploaded screenshots and photos:
  - First attempts to decode QR codes using OpenCV headless (cv2.QRCodeDetector).
    If a QR is detected, returns the decoded payload for a QR check.
  - Otherwise, runs Tesseract OCR (with English and Telugu) via pytesseract.
  - If text is empty or confidence is low, returns an error asking the user
    to paste the text instead.
  - Handles missing OCR languages or system binaries gracefully.
"""

import io
from typing import Any, Optional

import cv2
import numpy as np
from PIL import Image

from app.signals import Signal

DETECTOR_NAME = "ocr"


def decode_qr(image_data: bytes | np.ndarray) -> Optional[str]:
    """Decode a QR code from raw image bytes or a numpy image array.

    Uses OpenCV's headless QRCodeDetector.
    Returns the decoded text string if found, or None.
    """
    if isinstance(image_data, bytes):
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    else:
        img = image_data

    if img is None or img.size == 0:
        return None

    detector = cv2.QRCodeDetector()
    decoded_info, points, _ = detector.detectAndDecode(img)
    if decoded_info and decoded_info.strip():
        return decoded_info.strip()

    return None


def extract_text(
    image_data: bytes | np.ndarray,
    lang: str = "eng+tel",
    min_confidence: float = 30.0,
) -> tuple[str, float]:
    """Extract text from an image using Tesseract OCR.

    Parameters:
      image_data: Raw image bytes or numpy array.
      lang: Tesseract language codes (defaults to English + Telugu).
      min_confidence: Minimum word confidence threshold (0-100).

    Returns:
      (extracted_text, average_confidence)
      Returns ("", 0.0) if Tesseract is unavailable, fails, or produces no text.
    """
    try:
        import pytesseract
    except ImportError:
        return "", 0.0

    # Convert to PIL Image
    try:
        if isinstance(image_data, bytes):
            pil_img = Image.open(io.BytesIO(image_data))
        else:
            # OpenCV image (BGR) -> RGB PIL Image
            if len(image_data.shape) == 2:
                pil_img = Image.fromarray(image_data)
            else:
                rgb = cv2.cvtColor(image_data, cv2.COLOR_BGR2RGB)
                pil_img = Image.fromarray(rgb)
    except Exception:
        return "", 0.0

    # Try running Tesseract with specified language, fallback to 'eng' if language pack is missing
    data = None
    for target_lang in [lang, "eng"]:
        try:
            data = pytesseract.image_to_data(
                pil_img,
                lang=target_lang,
                output_type=pytesseract.Output.DICT,
            )
            break
        except Exception:
            continue

    if not data or "text" not in data or "conf" not in data:
        return "", 0.0

    words: list[str] = []
    confs: list[float] = []

    for word, conf in zip(data["text"], data["conf"]):
        w = str(word).strip()
        try:
            c = float(conf)
        except (ValueError, TypeError):
            c = -1.0

        if w and c > 0:
            words.append(w)
            confs.append(c)

    if not words:
        return "", 0.0

    avg_conf = sum(confs) / len(confs) if confs else 0.0
    text_content = " ".join(words).strip()
    return text_content, avg_conf


def process_image(
    image_data: bytes,
    min_confidence: float = 30.0,
) -> dict[str, Any]:
    """Process an uploaded image: check for QR first, otherwise run OCR.

    Returns a dict with:
      - type: "qr" | "text"
      - payload: extracted QR payload (if type == "qr")
      - text: extracted OCR text (if type == "text" and successful)
      - confidence: OCR confidence score (0-100)
      - error: user-facing error message prompting text paste if low quality
    """
    # 1. Try decoding as QR first
    qr_payload = decode_qr(image_data)
    if qr_payload:
        return {
            "type": "qr",
            "payload": qr_payload,
            "text": None,
            "confidence": 100.0,
            "error": None,
        }

    # 2. Run OCR on the image
    text, conf = extract_text(image_data, min_confidence=min_confidence)
    if not text or conf < min_confidence:
        return {
            "type": "text",
            "payload": None,
            "text": None,
            "confidence": conf,
            "error": (
                "Could not read text clearly from the image. "
                "Please copy and paste the message text instead."
            ),
        }

    return {
        "type": "text",
        "payload": None,
        "text": text,
        "confidence": conf,
        "error": None,
    }


def detect(image_data: bytes) -> Signal:
    """Run OCR / QR image detection and return a Signal object (AGENTS.md Rule 5)."""
    result = process_image(image_data)

    if result["type"] == "qr":
        return Signal.ok(
            detector=DETECTOR_NAME,
            evidence=[f"Decoded QR code from image: {result['payload']}"],
            explanation_key="ocr_qr_decoded",
        )

    if result["error"]:
        return Signal.caution(
            detector=DETECTOR_NAME,
            score=0.0,
            evidence=[result["error"]],
            explanation_key="ocr_low_confidence",
        )

    return Signal.ok(
        detector=DETECTOR_NAME,
        evidence=[
            f"Extracted {len(result['text'])} characters from image (confidence: {result['confidence']:.0f}%)"
        ],
        explanation_key="ocr_text_extracted",
    )
