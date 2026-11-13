# Changelog

All notable changes to QRaksha-Kavach will be documented in this file.

## [Unreleased]

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
