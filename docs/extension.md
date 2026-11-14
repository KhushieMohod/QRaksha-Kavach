# Adding a New Signal Detector in ~10 Minutes

This guide explains how to extend **QRaksha-Kavach** with a new scam detection module while preserving the architecture, privacy constraints, and configuration-driven design mandated by `SPEC.md` and `AGENTS.md`.

---

## 1. Architectural Principles

Every detector in QRaksha-Kavach must follow these five non-negotiable principles:

1. **Standard `Signal` Output**: Every detector returns the `Signal` Pydantic model (`app/signals.py`). Never invent custom return formats.
2. **Zero Hardcoded Rules**: Thresholds, limits, keywords, and weights must live in `backend/app/config/*.yaml`.
3. **Predefined Safety Explanations**: User-facing warnings and next steps must come exclusively from `backend/app/config/explanations.yaml`. Never dynamically generate safety advice with an LLM.
4. **Hierarchical Fusion Integration**: Detectors feed into `app/fusion.py`. `danger` signals trigger immediate `DANGER` (never averaged away); `caution` triggers `CAUTION`.
5. **Comprehensive Automated Tests**: Every detector must have a corresponding test suite in `backend/tests/test_<detector>.py` covering normal, suspicious, edge, and invalid inputs.

---

## 2. The `Signal` Model Contract

Every detector returns an instance of `Signal` (`backend/app/signals.py`):

```python
from app.signals import Signal

# 1. Safe / Clean Signal
Signal.ok(
    detector="your_detector_name",
    evidence=["Detailed reason why check passed"],
    explanation_key="optional_explanation_key",
)

# 2. Caution Signal (Mild concern, e.g. unknown handle or crowd drift)
Signal.caution(
    detector="your_detector_name",
    score=0.60,
    evidence=["Warning reason explaining risk"],
    explanation_key="explanation_key_in_yaml",
)

# 3. Danger Signal (Critical threat, e.g. sticker swap or phishing handle)
Signal.danger(
    detector="your_detector_name",
    score=0.95,
    evidence=["Critical threat indicator detected"],
    explanation_key="explanation_key_in_yaml",
)
```

---

## 3. Step-by-Step Walkthrough: Excessive Payment Amount Detector

In this 10-minute walkthrough, we will implement an **Excessive Amount Detector** that alerts elderly users when a scanned QR code requests an unusually high amount (e.g. $> \text{Rs } 5,000$).

### Step 1: Add Configuration Thresholds (2 minutes)

Open `backend/app/config/thresholds.yaml` and add the configurable thresholds:

```yaml
# Excessive transaction amount thresholds (in INR)
amount_caution_limit: 5000.0
amount_danger_limit: 25000.0
```

### Step 2: Add Multilingual Explanations (2 minutes)

Open `backend/app/config/explanations.yaml` and add the predefined localized advice:

```yaml
excessive_amount_caution:
  en: "This payment requests a high amount (over Rs 5,000). Please double-check with the recipient before paying."
  te: "ఈ చెల్లింపు అధిక మొత్తాన్ని కోరుతోంది (రూ. 5,000 కంటే ఎక్కువ). చెల్లించే ముందు గ్రహీతతో సరిచూసుకోండి."
  hi: "यह भुगतान एक बड़ी राशि (रु 5,000 से अधिक) का अनुरोध कर रहा है। कृपया भुगतान करने से पहले प्राप्तकर्ता से पुष्टि करें।"
  next_steps:
    - "Confirm the purchase price verbally with the shopkeeper"
    - "Do not enter your UPI PIN if you did not expect this charge"

excessive_amount_danger:
  en: "Extremely high payment amount requested (over Rs 25,000). Potential fraud or scam attempt."
  te: "చాలా ఎక్కువ మొత్తం అభ్యర్థించబడింది (రూ. 25,000 కంటే ఎక్కువ). మోసం లేదా స్కామ్ ప్రయత్నం కావచ్చు."
  hi: "अत्यधिक उच्च राशि का अनुरोध किया गया है (रु 25,000 से अधिक)। संभावित धोखाधड़ी या घोटाला।"
  next_steps:
    - "Stop payment immediately"
    - "Verify the transaction in person with the store manager"
```

### Step 3: Implement the Detector (3 minutes)

Create `backend/app/detectors/amount_limit.py`:

```python
"""Excessive amount detector.

Checks if a scanned QR code's payment amount exceeds safe limits.
"""

from typing import Optional
from app.config.loader import load_thresholds
from app.signals import Signal


def detect(amount_str: Optional[str]) -> Signal:
    """Evaluate whether the requested payment amount is safe.

    Parameters:
      amount_str: The raw 'am' parameter from a UPI URI (e.g. '500.00').

    Returns:
      Signal object with severity 'ok', 'caution', or 'danger'.
    """
    if not amount_str:
        return Signal.ok(
            detector="amount_limit",
            evidence=["no amount specified in QR"],
            explanation_key="no_amount_specified",
        )

    try:
        amount = float(amount_str.strip())
    except (ValueError, TypeError):
        return Signal.ok(
            detector="amount_limit",
            evidence=["invalid amount string"],
        )

    thresholds = load_thresholds()
    caution_limit = float(thresholds.get("amount_caution_limit", 5000.0))
    danger_limit = float(thresholds.get("amount_danger_limit", 25000.0))

    if amount >= danger_limit:
        return Signal.danger(
            detector="amount_limit",
            score=0.92,
            evidence=[f"Requested amount Rs {amount:,.2f} exceeds danger threshold Rs {danger_limit:,.2f}"],
            explanation_key="excessive_amount_danger",
        )
    elif amount >= caution_limit:
        return Signal.caution(
            detector="amount_limit",
            score=0.65,
            evidence=[f"Requested amount Rs {amount:,.2f} exceeds caution threshold Rs {caution_limit:,.2f}"],
            explanation_key="excessive_amount_caution",
        )

    return Signal.ok(
        detector="amount_limit",
        evidence=[f"Amount Rs {amount:,.2f} is within normal limits"],
    )
```

Export your detector in `backend/app/detectors/__init__.py`:

```python
from app.detectors import amount_limit
```

### Step 4: Hook into Check Workflow (`backend/app/main.py`) (1 minute)

In `backend/app/main.py` inside `_perform_qr_check`:

```python
# Extract amount from parsed QR payload
am = parsed.payload.am if parsed.is_valid else None
amount_sig = amount_limit.detect(am)
signals.append(amount_sig)
```

Because `fusion.py` evaluates all signals hierarchically, any `danger` or `caution` returned by `amount_limit` will automatically feed into the unified verdict and display the localized explanation!

### Step 5: Write Automated Tests (2 minutes)

Create `backend/tests/test_amount_limit.py`:

```python
import pytest
from app.detectors import amount_limit

def test_normal_amount_returns_ok():
    sig = amount_limit.detect("150.00")
    assert sig.severity == "ok"
    assert sig.score == 0.0

def test_caution_amount_returns_caution():
    sig = amount_limit.detect("6500.00")
    assert sig.severity == "caution"
    assert sig.score >= 0.6
    assert sig.explanation_key == "excessive_amount_caution"

def test_danger_amount_returns_danger():
    sig = amount_limit.detect("30000.00")
    assert sig.severity == "danger"
    assert sig.score >= 0.9
    assert sig.explanation_key == "excessive_amount_danger"

def test_missing_or_invalid_amount_returns_ok():
    assert amount_limit.detect(None).severity == "ok"
    assert amount_limit.detect("abc").severity == "ok"
```

Run tests to verify:

```bash
pytest backend/tests/test_amount_limit.py
```

Done! In ~10 minutes, your new detector is fully integrated, verified, and ready for production.
