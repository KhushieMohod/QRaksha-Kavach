"""Verdict fusion engine (SPEC Section 7).

Applies the four hierarchical fusion rules strictly in order:
  1. Any danger signal gives DANGER (registry mismatch, story_link hit,
     lookalike danger, scam score at least scam_danger). Hard rules are not averaged away.
  2. Else any caution signal gives CAUTION (lookalike caution, crowd_baseline
     change, scam score from scam_caution to scam_danger).
  3. Else if registry_binding says 'matches registry', gives VERIFIED.
  4. Else gives UNVERIFIED. For a text-only check, shows:
     'No scam signs found. This is not a guarantee.'

Extracts every non-ok reason and pulls multilingual explanations and next_steps
from explanations.yaml using the strongest reason's key.
"""

from typing import Literal, Optional
from pydantic import BaseModel, Field

from app.config.loader import load_explanations
from app.signals import Signal

VerdictType = Literal["VERIFIED", "UNVERIFIED", "CAUTION", "DANGER"]


class ReasonItem(BaseModel):
    """A single non-ok reason supporting the verdict."""

    detector: str
    severity: str
    evidence: list[str] = Field(default_factory=list)
    explanation_key: Optional[str] = None


class ExplanationDict(BaseModel):
    """Multilingual user-facing safety explanation."""

    en: str
    te: Optional[str] = None
    hi: Optional[str] = None


class FusedVerdict(BaseModel):
    """Unified verdict returned by the fusion engine."""

    verdict: VerdictType
    reasons: list[ReasonItem] = Field(default_factory=list)
    explanation: ExplanationDict
    next_steps: list[str] = Field(default_factory=list)


class CheckResponse(BaseModel):
    """Standard API response shape for all check endpoints (SPEC Section 4.4)."""

    request_id: str
    verdict: VerdictType
    reasons: list[ReasonItem] = Field(default_factory=list)
    explanation: ExplanationDict
    next_steps: list[str] = Field(default_factory=list)
    latency_ms: int


def _get_explanation_data(key: str) -> tuple[ExplanationDict, list[str]]:
    """Look up multilingual explanation and next steps from explanations.yaml."""
    explanations = load_explanations()
    entry = explanations.get(key, {})

    en_text = entry.get("en", "Please review payment details carefully before authorizing.")
    te_text = entry.get("te", None)
    hi_text = entry.get("hi", None)
    next_steps = entry.get("next_steps", ["Verify recipient details directly before paying"])

    return ExplanationDict(en=en_text, te=te_text, hi=hi_text), next_steps


def fuse_signals(
    signals: list[Signal],
    check_type: str = "qr",
) -> FusedVerdict:
    """Fuse multiple detector signals into one unified safety verdict.

    Parameters:
      signals: List of Signal objects collected from all active detectors.
      check_type: "qr" | "text" | "image"

    Returns:
      FusedVerdict object with verdict, non-ok reasons, explanation, and next steps.
    """
    # 1. Filter all non-ok signals
    danger_signals = [s for s in signals if s.severity == "danger"]
    caution_signals = [s for s in signals if s.severity == "caution"]
    non_ok_signals = [s for s in signals if s.severity in ("danger", "caution")]

    # Reason items list every non-ok reason (SPEC Section 7)
    reasons = [
        ReasonItem(
            detector=s.detector,
            severity=s.severity,
            evidence=s.evidence,
            explanation_key=s.explanation_key,
        )
        for s in non_ok_signals
    ]

    # Rule 1: Any danger signal gives DANGER
    if danger_signals:
        # Pick the danger signal with the highest score as the strongest reason
        strongest = max(danger_signals, key=lambda s: s.score)
        key = strongest.explanation_key or "payee_not_registered_here"
        explanation, next_steps = _get_explanation_data(key)
        return FusedVerdict(
            verdict="DANGER",
            reasons=reasons,
            explanation=explanation,
            next_steps=next_steps,
        )

    # Rule 2: Else any caution signal gives CAUTION
    if caution_signals:
        # Pick the caution signal with the highest score as the strongest reason
        strongest = max(caution_signals, key=lambda s: s.score)
        key = strongest.explanation_key or "unknown_handle_suffix"
        explanation, next_steps = _get_explanation_data(key)
        return FusedVerdict(
            verdict="CAUTION",
            reasons=reasons,
            explanation=explanation,
            next_steps=next_steps,
        )

    # Rule 3: Else if registry_binding says 'matches registry', give VERIFIED
    registry_matched = any(
        s.detector == "registry_binding"
        and ("matches registry" in s.evidence or s.explanation_key == "matches_registry")
        for s in signals
    )
    if registry_matched:
        explanation, next_steps = _get_explanation_data("matches_registry")
        return FusedVerdict(
            verdict="VERIFIED",
            reasons=reasons,
            explanation=explanation,
            next_steps=next_steps,
        )

    # Rule 4: Else give UNVERIFIED
    if check_type == "text":
        explanation, next_steps = _get_explanation_data("text_unverified")
    elif check_type in ("apk", "apk_meta"):
        explanation, next_steps = _get_explanation_data("apk_safe_ok")
    else:
        # Check if there is an unverified / no registry explanation key from signals
        unverified_sig = next(
            (s for s in signals if s.explanation_key in ("no_registry_data", "insufficient_baseline_data")),
            None,
        )
        key = unverified_sig.explanation_key if unverified_sig else "no_registry_data"
        explanation, next_steps = _get_explanation_data(key)

    return FusedVerdict(
        verdict="UNVERIFIED",
        reasons=reasons,
        explanation=explanation,
        next_steps=next_steps,
    )
