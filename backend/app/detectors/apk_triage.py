"""APK Static Metadata Triage Detector (SPEC Section 6.8 & AGENTS.md Rule 10).

Evaluates static metadata supplied as JSON only:
- file_name: scanned for social engineering lures (challan, kisan, kyc, update, bill, etc.)
- permissions: evaluated for high-risk surveillance permissions (SMS, Accessibility, Device Admin)
- source: verified against trusted app stores

SECURITY MANDATE:
  Never execute, install, unpack, or dynamically analyze APK binaries.
  Treat all metadata as untrusted input.
"""

from typing import Any, Optional
from pydantic import BaseModel, Field

from app.config.loader import load_rules, load_thresholds
from app.signals import Signal

DETECTOR_NAME = "apk_triage"


class APKMetadata(BaseModel):
    """Static APK metadata submitted for triage."""

    file_name: str = Field(description="Name of the APK package file (e.g. Traffic_Challan.apk)")
    permissions: list[str] = Field(
        default_factory=list,
        description="List of Android permissions requested in manifest",
    )
    source: str = Field(
        default="unknown",
        description="Source of distribution (e.g. google_play, whatsapp_attachment, sms_link)",
    )


def detect(metadata: APKMetadata | dict[str, Any]) -> Signal:
    """Analyze static APK metadata and return a Signal conforming to SPEC Section 4.2.

    Returns:
      - DANGER: High risk score (>= 0.8) or critical device control permissions from untrusted source.
      - CAUTION: Moderate risk (>= 0.5), such as unverified sideloading or lure keyword without SMS.
      - OK: Standard package with no dangerous permissions from trusted source.
    """
    if isinstance(metadata, dict):
        meta = APKMetadata(**metadata)
    else:
        meta = metadata

    rules = load_rules()
    apk_rules = rules.get("apk_triage", {})
    lure_keywords: list[str] = apk_rules.get("lure_filename_keywords", [])
    dangerous_perms_cfg: list[str] = apk_rules.get("dangerous_permissions", [])
    critical_perms_cfg: list[str] = apk_rules.get("critical_permissions", [])
    trusted_sources: list[str] = apk_rules.get("trusted_sources", [])
    weights_cfg = apk_rules.get("weights", {})

    weight_lure = float(weights_cfg.get("lure_filename", 0.35))
    weight_dangerous_perm = float(weights_cfg.get("dangerous_permission", 0.25))
    weight_critical_perm = float(weights_cfg.get("critical_permission", 0.50))
    weight_untrusted_source = float(weights_cfg.get("non_store_source", 0.30))

    thresholds = load_thresholds()
    scam_danger = float(thresholds.get("scam_danger", 0.8))
    scam_caution = float(thresholds.get("scam_caution", 0.5))

    matched_weights: list[float] = []
    evidence: list[str] = []

    # 1. Analyze file_name for social engineering lures
    clean_filename = (meta.file_name or "").lower()
    matched_lures = [kw for kw in lure_keywords if kw in clean_filename]
    if matched_lures:
        matched_weights.append(weight_lure)
        evidence.append(
            f"File name '{meta.file_name}' contains social engineering lure keywords: {matched_lures}"
        )

    # 2. Analyze permissions
    normalized_perms = {p.strip().upper() for p in meta.permissions}
    
    # Helper to check permission containment
    def _matches_perm_list(perm_list: list[str]) -> list[str]:
        hits = []
        for p in normalized_perms:
            p_short = p.replace("ANDROID.PERMISSION.", "")
            for target in perm_list:
                t_upper = target.upper()
                t_short = t_upper.replace("ANDROID.PERMISSION.", "")
                if p == t_upper or p_short == t_short:
                    hits.append(p)
                    break
        return hits

    critical_hits = _matches_perm_list(critical_perms_cfg)
    dangerous_hits = [
        p for p in _matches_perm_list(dangerous_perms_cfg) if p not in critical_hits
    ]

    for hit in critical_hits:
        matched_weights.append(weight_critical_perm)
        evidence.append(f"Requests critical surveillance/control permission: {hit}")

    for hit in dangerous_hits:
        matched_weights.append(weight_dangerous_perm)
        evidence.append(f"Requests dangerous permission: {hit}")

    # 3. Analyze distribution source
    clean_source = (meta.source or "unknown").strip().lower()
    is_trusted_store = any(trusted in clean_source for trusted in trusted_sources)
    if not is_trusted_store:
        matched_weights.append(weight_untrusted_source)
        evidence.append(f"Distributed outside verified app stores (source: '{meta.source}')")

    # 4. Combine weights using independence product: 1 - prod(1 - w)
    if not matched_weights:
        score = 0.0
    else:
        prod = 1.0
        for w in matched_weights:
            prod *= (1.0 - min(0.99, w))
        score = round(1.0 - prod, 3)

    # Override: if critical permissions (Accessibility / Device Admin) + untrusted source, score is at least 0.90
    if critical_hits and not is_trusted_store:
        score = max(score, 0.90)

    # 5. Map to Signal severity
    if score >= scam_danger or (len(dangerous_hits) >= 2 and not is_trusted_store and matched_lures):
        score = max(score, 0.85)
        return Signal.danger(
            detector=DETECTOR_NAME,
            score=score,
            evidence=evidence,
            explanation_key="apk_malicious_danger",
        )
    elif score >= scam_caution or (not is_trusted_store and (dangerous_hits or matched_lures)):
        return Signal.caution(
            detector=DETECTOR_NAME,
            score=max(score, 0.55),
            evidence=evidence,
            explanation_key="apk_suspicious_caution",
        )
    else:
        return Signal.ok(
            detector=DETECTOR_NAME,
            evidence=["No high-risk lure patterns or unauthorized permissions detected in metadata"],
            explanation_key="apk_safe_ok",
        )
