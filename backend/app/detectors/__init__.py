"""Detectors package for scam and anomaly detection."""

from app.detectors import handle_lookalike, qr_parser

__all__ = ["qr_parser", "handle_lookalike"]
