"""UPI ID Handle Lookalike and Impersonation Detector (SPEC Section 6.2).

Splits the UPI ID into name part and handle suffix (name@suffix).
Rules:
  - Danger if name part contains a brand word plus a support word.
  - Danger if suffix is within lookalike_suffix_edit_distance of a known suffix (but !=).
  - Caution if suffix is completely unknown.
  - Caution if digits are swapped for letters in a brand word (e.g. sb1 -> sbi).
  - Otherwise ok.

Configuration:
  - Thresholds loaded from app/config/thresholds.yaml
  - Suffixes, brand words, support words from app/config/rules.yaml
"""

import re
from typing import Optional
from rapidfuzz.distance import Levenshtein

from app.config.loader import load_rules, load_thresholds
from app.signals import Signal

DETECTOR_NAME = "handle_lookalike"


def detect(upi_id: str) -> Signal:
    """Analyze a UPI VPA for lookalike or impersonation patterns.

    Returns Signal with severity ok, caution, or danger according to SPEC Section 6.2.
    """
    raw = (upi_id or "").strip()

    if not raw:
        return Signal.danger(
            detector=DETECTOR_NAME,
            score=1.0,
            evidence=["Empty UPI ID provided"],
            explanation_key="invalid_upi_id",
        )

    # Validate '@' delimiter
    if "@" not in raw:
        return Signal.danger(
            detector=DETECTOR_NAME,
            score=1.0,
            evidence=[f"Invalid UPI ID '{raw}': missing '@' delimiter"],
            explanation_key="invalid_upi_id",
        )

    parts = raw.split("@")
    if len(parts) != 2 or not parts[0].strip() or not parts[1].strip():
        return Signal.danger(
            detector=DETECTOR_NAME,
            score=1.0,
            evidence=[f"Invalid UPI ID '{raw}': malformed name@handle structure"],
            explanation_key="invalid_upi_id",
        )

    name_part = parts[0].strip().lower()
    suffix = parts[1].strip().lower()

    # Load configuration
    rules = load_rules()
    thresholds = load_thresholds()

    known_suffixes = [s.lower() for s in rules.get("known_handle_suffixes", [])]
    brand_words = [b.lower() for b in rules.get("brand_words", [])]
    support_words = [s.lower() for s in rules.get("support_words", [])]
    digit_subs = rules.get("digit_substitutions", {
        "0": "o", "1": "i", "3": "e", "4": "a", "5": "s"
    })
    max_edit_dist = int(thresholds.get("lookalike_suffix_edit_distance", 1))

    danger_evidence: list[str] = []
    caution_evidence: list[str] = []
    primary_danger_key: Optional[str] = None
    primary_caution_key: Optional[str] = None

    # -------------------------------------------------------------------------
    # 1. Suffix evaluation
    # -------------------------------------------------------------------------
    if suffix in known_suffixes:
        pass  # Suffix is recognized and exact
    else:
        # Compute minimum edit distance to any known handle suffix
        best_dist = 999
        closest_handle = None
        for known in known_suffixes:
            dist = Levenshtein.distance(suffix, known)
            if dist < best_dist:
                best_dist = dist
                closest_handle = known

        if best_dist <= max_edit_dist and closest_handle is not None:
            # Lookalike / typo suffix (e.g. oksbl vs oksbi) -> DANGER
            danger_evidence.append(
                f"Suspicious handle suffix '@{suffix}': {best_dist} edit away from legitimate handle '@{closest_handle}'"
            )
            if not primary_danger_key:
                primary_danger_key = "lookalike_suffix_typo"
        else:
            # Completely unknown suffix (e.g. xyzbank) -> CAUTION
            caution_evidence.append(
                f"Unknown handle suffix '@{suffix}' not in verified PSP directory"
            )
            if not primary_caution_key:
                primary_caution_key = "unknown_handle_suffix"

    # -------------------------------------------------------------------------
    # 2. Name part evaluation: Brand + Support word combination (DANGER)
    # -------------------------------------------------------------------------
    # Tokenize name by common separators
    tokens = [t for t in re.split(r'[^a-zA-Z0-9]+', name_part) if t]

    found_brands = set()
    found_supports = set()

    # Match tokens or sub-phrases
    for b in brand_words:
        if b in tokens or b in name_part:
            found_brands.add(b)

    for s in support_words:
        if s in tokens or s in name_part:
            found_supports.add(s)

    # Check for presence of distinct brand AND support words
    brand_support_pairs = []
    for b in found_brands:
        for s in found_supports:
            if b != s:
                brand_support_pairs.append((b, s))

    if brand_support_pairs:
        b_name, s_name = brand_support_pairs[0]
        danger_evidence.append(
            f"Payee name '{name_part}' combines trusted brand '{b_name}' with support term '{s_name}'"
        )
        if not primary_danger_key:
            primary_danger_key = "lookalike_brand_support"

    # -------------------------------------------------------------------------
    # 3. Name part evaluation: Digit swapping for brand words (CAUTION)
    # -------------------------------------------------------------------------
    for token in tokens:
        # Check if token contains digits
        if any(c.isdigit() for c in token):
            normalized = token
            for digit, char in digit_subs.items():
                normalized = normalized.replace(digit, char)

            if normalized in brand_words and token not in brand_words:
                caution_evidence.append(
                    f"Payee name uses digit-swapping '{token}' to mimic brand '{normalized}'"
                )
                if not primary_caution_key:
                    primary_caution_key = "lookalike_digit_swap"

    # -------------------------------------------------------------------------
    # 4. Final Verdict Resolution
    # -------------------------------------------------------------------------
    if danger_evidence:
        return Signal.danger(
            detector=DETECTOR_NAME,
            score=0.95,
            evidence=danger_evidence,
            explanation_key=primary_danger_key or "lookalike_handle_detected",
        )

    if caution_evidence:
        return Signal.caution(
            detector=DETECTOR_NAME,
            score=0.5,
            evidence=caution_evidence,
            explanation_key=primary_caution_key or "unknown_handle_suffix",
        )

    return Signal.ok(
        detector=DETECTOR_NAME,
        evidence=[f"UPI ID '{raw}' verified: handle '@{suffix}' is legitimate and name has no lookalike indicators"],
    )
