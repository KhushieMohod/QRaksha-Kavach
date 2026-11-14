"""Scam text detector (SPEC Section 6.5).

Two-layer detection:
  1. Rule layer — for each category in rules.yaml, search for pattern matches.
     A match within 6 words after a negation phrase is suppressed.
     Combine matched weights as: 1 - product(1 - weight_i).
  2. LLM layer — pass text to app/llm.py, get JSON with score, labels, spans.
     Every span must be an exact substring of the input; otherwise discard.
     Final score = max(rule_score, llm_score).
     LLM score counts only if it has at least one valid span.
  3. If the LLM is offline, use the rule score only.

Severity mapping (from thresholds.yaml):
  score >= scam_danger (0.8) => danger
  score >= scam_caution (0.5) => caution
  score < scam_caution => ok
"""

import re
from typing import Any, Optional

from sqlmodel import Session

from app.config.loader import load_rules, load_thresholds
from app.llm import build_scam_analysis_prompt, call_llm, is_llm_offline
from app.signals import Signal

DETECTOR_NAME = "scam_text"


# ---------------------------------------------------------------------------
# Rule layer
# ---------------------------------------------------------------------------

def _load_negation_phrases() -> list[str]:
    """Load negation phrases from rules.yaml."""
    rules = load_rules()
    return [p.lower() for p in rules.get("negation_phrases", [])]


def _load_scam_categories() -> dict[str, dict[str, Any]]:
    """Load scam categories (weight + patterns) from rules.yaml."""
    rules = load_rules()
    raw_cats = rules.get("scam_categories", {})
    categories: dict[str, dict[str, Any]] = {}
    for name, value in raw_cats.items():
        if isinstance(value, dict):
            categories[name] = {
                "weight": float(value.get("weight", 0.0)),
                "patterns": [p.lower() for p in value.get("patterns", [])],
            }
        else:
            # Backward compatibility: value is just a weight float
            categories[name] = {
                "weight": float(value),
                "patterns": [],
            }
    return categories


def _is_negated(
    text_lower: str,
    match_start: int,
    match_end: int,
    negation_phrases: list[str],
) -> bool:
    """Check if a pattern match is within 6 words of a negation phrase.

    SPEC Section 6.5: A pattern is ignored when a negation phrase appears
    within 6 words before it.
    """
    for neg in negation_phrases:
        start_search = 0
        while True:
            neg_pos = text_lower.find(neg, start_search)
            if neg_pos == -1 or neg_pos > match_end:
                break
            neg_end = neg_pos + len(neg)

            # Negation phrase appears before or overlaps the start of the match
            if neg_end <= match_start:
                between = text_lower[neg_end:match_start]
                if len(between.split()) <= 6:
                    return True
            elif neg_pos <= match_start:
                # The negation phrase is immediately attached to or overlaps match
                return True
            elif neg_pos < match_end:
                words_before = len(text_lower[neg_pos:match_start].split())
                if words_before <= 6:
                    return True

            start_search = neg_pos + 1

    return False


def rule_layer_score(text: str) -> tuple[float, list[str], list[str]]:
    """Compute the rule-based scam score for a text message.

    Returns:
      (score, matched_categories, matched_evidence)
    """
    text_lower = text.lower()
    categories = _load_scam_categories()
    negation_phrases = _load_negation_phrases()

    matched_weights: list[float] = []
    matched_categories: list[str] = []
    matched_evidence: list[str] = []

    for cat_name, cat_info in categories.items():
        weight = cat_info["weight"]
        patterns = cat_info["patterns"]

        for pattern in patterns:
            match = re.search(re.escape(pattern), text_lower)
            if match is None:
                continue

            # Check if negated
            if _is_negated(text_lower, match.start(), match.end(), negation_phrases):
                continue

            # Found a non-negated match for this category
            matched_weights.append(weight)
            matched_categories.append(cat_name)
            matched_evidence.append(
                f"Matched '{pattern}' (category: {cat_name}, weight: {weight})"
            )
            break  # One match per category is enough

    if not matched_weights:
        return 0.0, [], []

    # Combine: 1 - product(1 - weight_i)
    product = 1.0
    for w in matched_weights:
        product *= (1.0 - w)
    combined_score = 1.0 - product

    return combined_score, matched_categories, matched_evidence


# ---------------------------------------------------------------------------
# LLM layer
# ---------------------------------------------------------------------------

def llm_layer_score(
    text: str,
    session: Optional[Session] = None,
) -> tuple[float, list[str], list[str]]:
    """Call the LLM layer and validate the response.

    Returns:
      (score, labels, valid_spans)
      score is 0.0 if LLM is unavailable or response is invalid.
    """
    if is_llm_offline():
        return 0.0, [], []

    prompt = build_scam_analysis_prompt(text)
    result = call_llm(prompt, session=session)

    if result is None:
        return 0.0, [], []

    try:
        llm_score = float(result.get("score", 0.0))
        labels = result.get("labels", [])
        spans = result.get("spans", [])
    except (TypeError, ValueError, AttributeError):
        return 0.0, [], []

    # Validate spans: every span must be an exact substring of input
    valid_spans = [s for s in spans if isinstance(s, str) and s in text]

    # If no valid spans, discard the LLM result entirely
    if not valid_spans:
        return 0.0, [], []

    return llm_score, labels, valid_spans


# ---------------------------------------------------------------------------
# Combined detector
# ---------------------------------------------------------------------------

def detect(
    text: str,
    session: Optional[Session] = None,
) -> Signal:
    """Run the full scam text detection pipeline.

    Combines rule-based and LLM-based scoring as per SPEC Section 6.5.
    """
    thresholds = load_thresholds()
    scam_caution = float(thresholds.get("scam_caution", 0.5))
    scam_danger = float(thresholds.get("scam_danger", 0.8))

    # Layer 1: Rule-based scoring
    rule_score, rule_cats, rule_evidence = rule_layer_score(text)

    # Layer 2: LLM scoring
    llm_score, llm_labels, llm_spans = llm_layer_score(text, session=session)

    # Final score: max of rule score and LLM score (LLM only if it has valid spans)
    final_score = max(rule_score, llm_score)

    # Combine evidence
    all_evidence = list(rule_evidence)
    if llm_spans:
        all_evidence.append(f"LLM identified spans: {llm_spans}")
    all_categories = list(rule_cats)
    if llm_labels:
        all_categories.extend([l for l in llm_labels if l not in all_categories])

    if final_score >= scam_danger:
        return Signal.danger(
            detector=DETECTOR_NAME,
            score=final_score,
            evidence=all_evidence,
            explanation_key="scam_text_danger",
        )
    elif final_score >= scam_caution:
        return Signal.caution(
            detector=DETECTOR_NAME,
            score=final_score,
            evidence=all_evidence,
            explanation_key="scam_text_caution",
        )
    else:
        return Signal.ok(
            detector=DETECTOR_NAME,
            evidence=["No scam patterns detected"] if not all_evidence else all_evidence,
            explanation_key="scam_text_ok",
        )
