"""Centralized LLM integration for QRaksha-Kavach (SPEC Section 14.2).

All LLM calls MUST go through this module.  It provides:
  - A single call_llm() entry point with response caching in the llm_cache table.
  - Temperature 0 for deterministic outputs.
  - 8-second request timeout.
  - Automatic rules-only fallback when the LLM is unavailable or LLM_OFFLINE=1.
  - Structured JSON validation of LLM responses before use.
  - The LLM NEVER writes safety advice shown to users.
"""

import hashlib
import json
import os
from typing import Any, Optional

from sqlmodel import Session, select

from app.config.loader import load_thresholds
from app.models import LLMCache


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

def is_llm_offline() -> bool:
    """Return True if LLM is disabled via the LLM_OFFLINE environment variable."""
    return os.environ.get("LLM_OFFLINE", "0").strip() in ("1", "true", "yes")


def _prompt_hash(text: str) -> str:
    """Return the SHA-256 hex digest of a prompt string for cache keys."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Cache operations
# ---------------------------------------------------------------------------

def get_cached_response(session: Session, prompt: str) -> Optional[str]:
    """Look up a cached LLM response by prompt hash.

    Returns the raw response string if found, or None.
    """
    h = _prompt_hash(prompt)
    entry = session.exec(
        select(LLMCache).where(LLMCache.prompt_hash == h)
    ).first()
    if entry is not None:
        return entry.response_text
    return None


def store_cached_response(
    session: Session,
    prompt: str,
    response: str,
    model_name: Optional[str] = None,
) -> None:
    """Store an LLM response in the cache table."""
    h = _prompt_hash(prompt)
    # Upsert: check if already exists
    existing = session.exec(
        select(LLMCache).where(LLMCache.prompt_hash == h)
    ).first()
    if existing is not None:
        return  # already cached
    entry = LLMCache(
        prompt_hash=h,
        prompt_text=prompt,
        response_text=response,
        model_name=model_name,
    )
    session.add(entry)
    session.commit()


# ---------------------------------------------------------------------------
# LLM calling with caching, timeout and fallback
# ---------------------------------------------------------------------------

def call_llm(
    prompt: str,
    session: Optional[Session] = None,
    timeout_seconds: Optional[int] = None,
) -> Optional[dict[str, Any]]:
    """Call the LLM with caching and offline fallback.

    Steps:
      1. If LLM_OFFLINE=1, return None immediately (rules-only fallback).
      2. Check the cache; if found, parse and return the JSON.
      3. Call the hosted LLM API with temperature 0 and the configured timeout.
      4. Validate and structure the response as JSON.
      5. Cache the response.
      6. If the LLM call fails (timeout, network, parse error), return None.

    Returns:
      Parsed JSON dict from the LLM, or None if unavailable / offline / invalid.
    """
    if is_llm_offline():
        return None

    thresholds = load_thresholds()
    timeout_s = timeout_seconds or int(thresholds.get("llm_timeout_seconds", 8))

    # Step 2: Check cache
    if session is not None:
        cached = get_cached_response(session, prompt)
        if cached is not None:
            try:
                return json.loads(cached)
            except json.JSONDecodeError:
                return None

    # Step 3: Call the hosted LLM API
    api_url = os.environ.get("LLM_API_URL", "")
    api_key = os.environ.get("LLM_API_KEY", "")

    if not api_url or not api_key:
        # No LLM configured — fall back to rules
        return None

    try:
        import httpx

        request_body = {
            "model": os.environ.get("LLM_MODEL", "gemini-2.0-flash"),
            "messages": [
                {"role": "user", "content": prompt},
            ],
            "temperature": 0,
        }

        with httpx.Client(timeout=timeout_s) as client:
            resp = client.post(
                api_url,
                json=request_body,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()

        raw_body = resp.json()
        # Extract the LLM text — works for OpenAI-compatible and Gemini APIs
        content_text = ""
        if "choices" in raw_body:
            content_text = raw_body["choices"][0]["message"]["content"]
        elif "candidates" in raw_body:
            content_text = raw_body["candidates"][0]["content"]["parts"][0]["text"]
        else:
            content_text = json.dumps(raw_body)

        # Step 4: Parse the content as JSON
        parsed = json.loads(content_text)

        # Step 5: Cache the response
        if session is not None:
            store_cached_response(session, prompt, content_text)

        return parsed

    except Exception:
        # Step 6: LLM unavailable — fallback to rules
        return None


# ---------------------------------------------------------------------------
# Scam analysis prompt builder
# ---------------------------------------------------------------------------

def build_scam_analysis_prompt(text: str) -> str:
    """Build a prompt that asks the LLM to classify a message for scam signals.

    The LLM must return JSON with:
      - score: float from 0 (safe) to 1 (definite scam)
      - labels: list of scam category strings
      - spans: list of exact substrings from the input text

    The LLM is NOT asked to generate safety advice.
    """
    return (
        "Classify the following message for scam signals. "
        "Return ONLY valid JSON with these fields:\n"
        '  "score": a float from 0.0 (safe) to 1.0 (definite scam),\n'
        '  "labels": a list of scam category strings (e.g. "kyc_update", '
        '"digital_arrest", "otp_pin_request"),\n'
        '  "spans": a list of exact substrings from the input text that '
        "are evidence of a scam.\n\n"
        "Rules:\n"
        "- Every span MUST be an exact substring of the input text.\n"
        "- Do NOT generate safety advice or recommendations.\n"
        "- If the message is not a scam, return score 0.0 with empty labels and spans.\n"
        "- Legitimate OTP messages that say 'do not share' are NOT scams.\n\n"
        f"Message:\n{text}"
    )
