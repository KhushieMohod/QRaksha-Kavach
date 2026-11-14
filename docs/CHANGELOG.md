# Changelog

All notable changes to QRaksha-Kavach will be documented in this file.

## [Unreleased]

### Step 4 — Scam Text Detector & LLM Integration (2026-11-14)

**Plan:**
- Implement centralized LLM client in `backend/app/llm.py` (SPEC Sections 3, 14.2):
  - Single entry point `call_llm()` with temperature 0 for deterministic outputs.
  - 8-second request timeout (`llm_timeout_seconds` from `thresholds.yaml`).
  - Response caching in SQLite `llm_cache` table keyed by SHA-256 prompt hash.
  - Transparent rules-only fallback when offline (`LLM_OFFLINE=1`) or when API is unreachable.
  - Structured prompt building requesting score, labels, and exact substring spans without generating dynamic safety advice (Rule 8).
- Configure all 11 scam categories in `backend/app/config/rules.yaml` with weighted scoring and ~10 patterns in English and transliterated Hindi/Telugu:
  - `otp_pin_request` (0.7), `kyc_update` (0.5), `digital_arrest` (0.8), `apk_install` (0.7), `scan_to_receive` (0.7), `prize_refund` (0.5), `parcel_customs` (0.5), `impersonation_authority` (0.5), `payment_demand` (0.4), `urgency_threat` (0.3), `link_shortener` (0.3).
  - Native script patterns marked "needs human check".
  - Negation phrases (`never share`, `do not share`, `will never ask`, etc.) suppressing pattern matches within 6 words before the match.
- Implement two-layer detector in `backend/app/detectors/scam_text.py` (SPEC Section 6.5):
  - Layer 1 (Rules): Combines matched weights as $1 - \prod(1 - w_i)$ and applies 6-word negation suppression.
  - Layer 2 (LLM): Parses JSON score and labels; strictly verifies that every span is an exact substring of the input text, discarding invalid responses.
  - Final score: $\max(\text{rule\_score}, \text{llm\_score})$.
  - Mapped to severity levels using thresholds: score $\ge 0.8 \rightarrow$ `danger`, $\ge 0.5 \rightarrow$ `caution`, $< 0.5 \rightarrow$ `ok`.
- Create synthetic dataset in `data/messages_labelled.json`:
  - 50 messages total (25 scam, 25 legit) split into 30 development messages and 20 held-out test messages.
  - Tuned patterns exclusively on the 30 dev messages (achieving 100% dev accuracy).
- Add centralized explanation keys (`scam_text_danger`, `scam_text_caution`, `scam_text_ok`) in `backend/app/config/explanations.yaml`.
- Export `scam_text` detector in `backend/app/detectors/__init__.py`.
- Create test suite in `backend/tests/test_scam_text.py`:
  - Test all 7 rows from SPEC Table 6.5.
  - Test weight combination formula and 6-word negation window.
  - Test offline mode (`LLM_OFFLINE=1`), SQLite cache hit, and span validation.
  - Evaluate on the 20 held-out messages: Accuracy 95.0%, Precision 100.0%, Recall 90.0%, FPR 0.0%.
- Acceptance: Full test suite passes (92 tests) and clean database seed idempotency confirmed.

**Files created/modified:**
- `backend/app/llm.py` (created)
- `backend/app/detectors/scam_text.py` (created)
- `data/messages_labelled.json` (created)
- `backend/tests/test_scam_text.py` (created)
- `backend/app/config/rules.yaml` (modified)
- `backend/app/config/explanations.yaml` (modified)
- `backend/app/detectors/__init__.py` (modified)
- `docs/CHANGELOG.md` (modified)

---

### Step 3 — Registry Binding & Merchant Alerts (2026-11-14)

**Plan:**
- Implement Haversine great-circle distance directly in Python ($R = 6,371,000$ m) without external geographic libraries (SPEC 14.1, 6.3).
- Implement `registry_binding` detector in `backend/app/detectors/registry_binding.py` (SPEC Section 6.3):
  - If `shop_code` is given: look up merchant directly; compare registered UPI ID.
  - If not given: find nearest merchant within `registry_radius_m` (100 m).
  - Match -> `Signal.ok` ("matches registry").
  - Mismatch -> `Signal.danger` ("payee_not_registered_here") and trigger merchant alert.
  - No merchant within radius or unknown shop code -> `Signal.ok` ("no registry data").
  - Validated all 6 cases in SPEC Section 6.3 table.
- Implement `crowd_baseline` detector in `backend/app/detectors/crowd_baseline.py` (SPEC Section 6.4):
  - Group scans by coarse location cell (3 decimal places, ~111 m).
  - Evaluate scan history within `baseline_days` (30 days).
  - Require at least `baseline_min_scans` (8 scans) with >= `baseline_share` (70%) for a dominant payee.
  - If new scan differs from dominant payee -> `Signal.caution` ("payee here changed recently").
  - Strictly never emits danger (shops can legitimately change accounts).
- Implement merchant alert logic with 30-minute rate limiting and counter aggregation in `backend/app/alerts.py`.
- Add API endpoints in `backend/app/main.py`:
  - `POST /api/merchant/register` (status 201, unique shop code validation/auto-generation, coarse 3-decimal rounding).
  - `GET /api/merchant/{id}/alerts` (retrieval by merchant integer ID or shop code string, 404 handling).
- Create `backend/scripts/simulate_scans.py` for scan event simulation (swap bursts and crowd baseline drift).
- Store centralized user-facing safety explanations in `backend/app/config/explanations.yaml` (AGENTS.md Rule 8).
- Update SQLModel models in `backend/app/models.py` (`Alert` enhanced with `merchant_id`, `count`, `type`, `seen`, `details_json`).
- Write comprehensive tests in `backend/tests/test_registry_binding.py`, `backend/tests/test_crowd_baseline.py`, and `backend/tests/test_api_merchant.py`.
- Acceptance: 76 tests passing in pytest; clean DB seed idempotency verified.

**Files created/modified:**
- `backend/app/alerts.py` (created)
- `backend/app/detectors/registry_binding.py` (created)
- `backend/app/detectors/crowd_baseline.py` (created)
- `backend/app/config/explanations.yaml` (created)
- `backend/scripts/simulate_scans.py` (created)
- `backend/tests/test_registry_binding.py` (created)
- `backend/tests/test_crowd_baseline.py` (created)
- `backend/tests/test_api_merchant.py` (created)
- `backend/app/config/__init__.py` (modified)
- `backend/app/config/loader.py` (modified)
- `backend/app/detectors/__init__.py` (modified)
- `backend/app/main.py` (modified)
- `backend/app/models.py` (modified)
- `backend/app/signals.py` (modified)
- `docs/CHANGELOG.md` (modified)

---

### Step 2 — QR Parser & Lookalike Detector (2026-11-13)

**Plan:**
- Implement `Signal` data contract model in `backend/app/signals.py` conforming strictly to SPEC Section 4.2 (`detector`, `severity` in ok/caution/danger, `score`, `evidence`, `explanation_key`).
- Store all detection thresholds, weights, and vocabulary in external YAML configuration files under `backend/app/config/` as required by AGENTS.md Rule 6:
  - `thresholds.yaml`: `lookalike_suffix_edit_distance: 1`, `registry_radius_m: 100`, etc.
  - `rules.yaml`: `known_handle_suffixes`, `brand_words`, `support_words`, `digit_substitutions`, `scam_categories`, `negation_phrases`.
- Implement safe cached configuration loader in `backend/app/config/loader.py` and export via `backend/app/config/__init__.py`.
- Implement `qr_parser` detector in `backend/app/detectors/qr_parser.py` (SPEC Section 6.1):
  - Parse `upi://pay` URIs extracting `pa`, `pn`, `mc`, `am`, `tn`.
  - Validate against SPEC Table 6.1: valid link, missing `pa`, non-UPI link, odd/negative amount, and whitespace in payee address.
  - Never treat `pn` as proof of identity.
- Implement `handle_lookalike` detector in `backend/app/detectors/handle_lookalike.py` (SPEC Section 6.2):
  - Split UPI ID into `name_part` and `suffix`.
  - Brand word + support word combination in name -> DANGER (`lookalike_brand_support`).
  - Suffix within 1 edit distance of a known suffix -> DANGER (`lookalike_suffix_typo`).
  - Unknown handle suffix -> CAUTION (`unknown_handle_suffix`).
  - Digits swapped for letters in brand words -> CAUTION (`lookalike_digit_swap`).
  - Legitimate handle with clean name -> OK.
- Create test suite in `backend/tests/test_qr_parser.py` and `backend/tests/test_handle_lookalike.py` validating every row of SPEC Tables 6.1 and 6.2 plus edge cases and config integrity.
- Verification: run full pytest suite (48 passed) and verify `seed.py` functions from an empty DB.

**Files created/modified:**
- `backend/app/signals.py` (created)
- `backend/app/config/thresholds.yaml` (created)
- `backend/app/config/rules.yaml` (created)
- `backend/app/config/loader.py` (created)
- `backend/app/config/__init__.py` (modified)
- `backend/app/detectors/qr_parser.py` (created)
- `backend/app/detectors/handle_lookalike.py` (created)
- `backend/app/detectors/__init__.py` (modified)
- `backend/tests/test_qr_parser.py` (created)
- `backend/tests/test_handle_lookalike.py` (created)
- `docs/CHANGELOG.md` (modified)

---

### Step 1 — Database and Seed Data (2026-11-13)

**Plan:**
- Implement all 6 SQLModel database tables in `backend/app/models.py`:
  - `Merchant`: Directory of registered merchants with coarse coordinates (3 decimals, ~111m precision).
  - `Scan`: Scan events with coarse user coordinates (3 decimals), raw redacted payloads, and verdicts.
  - `Alert`: Risk verdicts with JSON array of signal contributions and explanation keys.
  - `FlaggedPayee`: Community-flagged suspicious UPI IDs.
  - `Message`: Suspicious message texts with source metadata.
  - `LLMCache`: Cached LLM responses keyed by SHA-256 prompt hash.
- Strict privacy: No exact GPS coordinates, UPI PINs, passwords, or OTPs are stored anywhere.
- Implement database session engine and table creation in `backend/app/database.py`.
- Update `backend/app/main.py` with DB lifespan table creation and `GET /api/merchants` endpoint.
- Create `data/merchants.json` with 20 synthetic merchants (KIR-0001 through KIR-0020) in a 3 km box around (17.3850, 78.4867), including close neighbor shops and standard UPI VPAs (`*@okaxis`).
- Create `backend/scripts/seed.py` with idempotent insert logic.
- Add comprehensive test suite in `backend/tests/test_models.py` covering table creation, precision constraints, seed data validation, idempotency, and the merchants API.
- Update `pytest.ini` pythonpath to support both root and backend imports.

**Verification:**
- Ran full pytest suite: 22 passed.
- Ran `seed.py` on fresh DB: 20 inserted.
- Ran `seed.py` second time: 0 inserted, 20 total (idempotency confirmed).

**Files created/modified:**
- `backend/app/database.py` (created)
- `backend/app/models.py` (created)
- `backend/app/main.py` (modified)
- `backend/scripts/seed.py` (created)
- `backend/scripts/__init__.py` (created)
- `data/merchants.json` (created)
- `backend/tests/test_models.py` (created)
- `pytest.ini` (modified)
- `docs/CHANGELOG.md` (modified)

---

### Step 0 — Project Skeleton & Agent Rules (2026-11-13)

**Plan:**
- Create full folder layout: `backend/app`, `backend/app/detectors`, `backend/app/config`, `backend/tests`, `backend/scripts`, `frontend`, `data`, `docs`.
- Add `requirements.txt` with pinned Python 3.11 dependencies.
- Add `pytest.ini`, `.gitignore`, `.env.example`, `README.md` stub.
- Add `.github/workflows/ci.yml` (GitHub Actions — runs pytest).
- Create minimal `backend/app/main.py` (FastAPI with `/health` endpoint).
- Create `backend/tests/test_smoke.py` (smoke tests for the health endpoint).
- Verify: `pytest` passes, `uvicorn` starts cleanly.

**Files created:**
- `requirements.txt`
- `pytest.ini`
- `.gitignore`
- `.env.example`
- `.github/workflows/ci.yml`
- `README.md` (updated stub)
- `backend/app/__init__.py`
- `backend/app/main.py`
- `backend/app/detectors/__init__.py`
- `backend/app/config/__init__.py`
- `backend/tests/__init__.py`
- `backend/tests/test_smoke.py`
- `backend/scripts/.gitkeep`
- `frontend/.gitkeep`
- `data/.gitkeep`
- `docs/CHANGELOG.md`
