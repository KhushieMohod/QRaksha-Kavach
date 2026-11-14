"""Detectors package for scam and anomaly detection."""

from app.detectors import (
    crowd_baseline,
    handle_lookalike,
    qr_parser,
    registry_binding,
    scam_text,
)

__all__ = [
    "qr_parser",
    "handle_lookalike",
    "registry_binding",
    "crowd_baseline",
    "scam_text",
]
