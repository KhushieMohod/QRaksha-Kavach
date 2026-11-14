"""Signal data contract as defined in SPEC Section 4.2.

Every detector must return a Signal object with:
  - detector: name of the detector
  - severity: "ok" | "caution" | "danger"
  - score: float between 0.0 and 1.0
  - evidence: list of human-readable findings
  - explanation_key: optional key into explanations.yaml
"""

from typing import Literal, Optional
from pydantic import BaseModel, Field

SeverityLevel = Literal["ok", "caution", "danger"]


class Signal(BaseModel):
    """Structured signal emitted by any detector."""

    detector: str = Field(description="Name of the detector module")
    severity: SeverityLevel = Field(
        default="ok",
        description="Severity: ok, caution, or danger",
    )
    score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Confidence or risk score between 0.0 and 1.0",
    )
    evidence: list[str] = Field(
        default_factory=list,
        description="List of evidence strings supporting the verdict",
    )
    explanation_key: Optional[str] = Field(
        default=None,
        description="Key into explanations.yaml for user-facing explanation",
    )

    @classmethod
    def ok(
        cls,
        detector: str,
        evidence: Optional[list[str]] = None,
        explanation_key: Optional[str] = None,
    ) -> "Signal":
        """Convenience factory for an 'ok' signal with 0 score."""
        return cls(
            detector=detector,
            severity="ok",
            score=0.0,
            evidence=evidence or [],
            explanation_key=explanation_key,
        )

    @classmethod
    def caution(
        cls,
        detector: str,
        score: float,
        evidence: list[str],
        explanation_key: Optional[str] = None,
    ) -> "Signal":
        """Convenience factory for a 'caution' signal."""
        return cls(
            detector=detector,
            severity="caution",
            score=score,
            evidence=evidence,
            explanation_key=explanation_key,
        )

    @classmethod
    def danger(
        cls,
        detector: str,
        score: float,
        evidence: list[str],
        explanation_key: Optional[str] = None,
    ) -> "Signal":
        """Convenience factory for a 'danger' signal."""
        return cls(
            detector=detector,
            severity="danger",
            score=score,
            evidence=evidence,
            explanation_key=explanation_key,
        )

