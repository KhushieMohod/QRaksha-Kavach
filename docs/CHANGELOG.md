# Changelog

All notable changes to QRaksha-Kavach will be documented in this file.

## [Unreleased]

### Step 8 — Voice and APK Metadata Triage (2026-11-14)

**Plan:**
- Implement APK metadata triage detector in `backend/app/detectors/apk_triage.py` per SPEC Section 6.8:
  - Operates strictly on static JSON metadata (`file_name`, `package_name`, `permissions`, `source`).
  - Never executes, downloads, installs, or dynamically analyzes real APK binaries (following AGENTS.md Rule 10 and SPEC 6.8).
  - Flags lure keywords (`challan`, `kisan`, `kyc`, `invitation`, `update`, `bill`, etc.).
  - Flags critical permissions (`BIND_ACCESSIBILITY_SERVICE`, `BIND_DEVICE_ADMIN`) as high-risk/immediate danger.
  - Flags dangerous permissions (`READ_SMS`, `RECEIVE_SMS`, `SEND_SMS`, `REQUEST_INSTALL_PACKAGES`) and untrusted sources (sideload, browser, chat).
  - Uses the independence probability weight combination formula $1 - \prod(1 - w_i)$ and returns a standard `Signal` object.
- Create synthetic APK metadata samples in `data/apk_samples.json`:
  - 6 realistic samples: 3 harmless (Calculator from Play Store, TeluguCalendar from Play Store, Notes_Backup local utility) and 3 lure-style (Traffic_Challan with SMS/accessibility, PM_Kisan with SMS permissions, Electricity_Bill update with accessibility service).
- Add configuration and explanations:
  - In `backend/app/config/rules.yaml`: Add lure keywords, dangerous permissions, critical permissions, trusted sources, and configurable weights.
  - In `backend/app/config/explanations.yaml`: Predefined multilingual (en, te, hi) explanations for `apk_malicious_danger`, `apk_suspicious_caution`, `apk_safe_ok`, and `voice_transcribed_ok`.
  - In `backend/app/fusion.py`: Added check type routing for APK metadata checks.
- Implement API endpoints in `backend/app/main.py`:
  - `POST /api/check/apk-meta`: Validates static JSON metadata and runs APK triage, returning fused verdict, reasons, and localized explanation.
  - `POST /api/check/voice`: Accepts audio or form input, utilizes pre-cached transcripts for offline/demo reliability, and feeds transcribed text into the `scam_text` detector.
- Acceptance & Verification:
  - Full pytest test suite passes: 151 passed in `backend/tests/`.
  - Clean database seed idempotency confirmed: Seed 1: 20, Seed 2: 0.

**Files created/modified:**
- `backend/app/detectors/apk_triage.py` (created)
- `backend/app/detectors/__init__.py` (modified)
- `data/apk_samples.json` (created)
- `backend/app/config/rules.yaml` (modified)
- `backend/app/config/explanations.yaml` (modified)
- `backend/app/fusion.py` (modified)
- `backend/app/main.py` (modified)
- `backend/tests/test_apk_triage.py` (created)
- `backend/tests/test_voice.py` (created)
- `docs/CHANGELOG.md` (modified)

### Step 7 — Payer, Merchant and Demo Screens (2026-11-14)

**Plan:**
- Build frontend PWA (React + Vite + Tailwind) following SPEC Section 8.1 with all 5 screens:
  - Visual design: Warm unbleached-cotton/paper matte background (`#F6F4EE`), deep charcoal ink (`#1C1917`), flat 2px borders, terracotta-ochre primary buttons (`#C05621`), Atkinson Hyperlegible (with Noto Sans Telugu/Devanagari fallback) for copy, and IBM Plex Mono for UPI IDs/shop codes.
  - Accessibility: Font size $\ge 18$ px, high contrast, short sentences, and exact verdict colors (green VERIFIED, grey UNVERIFIED, amber CAUTION, red DANGER).
  - Screen 1 (Check): Large buttons for Scan QR (`html5-qrcode` camera & manual input modal), Check a message, Upload screenshot/photo, and Speak (voice simulation). Optional shop-code input and quick presets for 1-click testing.
  - Screen 2 (Result): Big coloured verdict badge, one-line plain language reason, Listen button (Browser Speech Synthesis API with pre-recorded Telugu demo audio fallback), actionable next steps, expandable evidence inspector, and multilingual EN / Telugu / Hindi toggle.
  - Screen 3 (Merchant): Kirana shop selector across 20 synthetic shops, QR health card (`OK` or `ALERT`), merchant alert list with counts and fraud payee IDs, and shop registration form.
  - Screen 4 (Demo panel): Interactive simulation triggers for `qr_swap`, `drift`, `scam_with_payee`, and `reset`, plus a 4-step guided Section 11 live demo walkthrough.
  - Screen 5 (Metrics): Live evaluation statistics populated from `/api/metrics` (100% deterministic scan accuracy, 95% held-out scam detection with 0% false alarm rate, sub-50ms latencies).
- Backend additions in `backend/app/main.py`:
  - `POST /api/demo/simulate`: Executes `qr_swap` (triggers swap scan and raises merchant alert), `drift` (seeds crowd baseline and tests payee drift), `scam_with_payee` (submits scam message and flags payee in database), and `reset` (restores clean 20-merchant seed state) with zero manual DB edits.
  - `GET /api/metrics`: Serves live evaluation metrics for Screen 5.
  - Added FastAPI `CORSMiddleware` to allow local development PWA integration.
- Pre-generated Telugu demo audio:
  - Synthesized playable WAV audio files in `frontend/public/audio/telugu/` (`verified.wav`, `unverified.wav`, `caution.wav`, `danger.wav`).
- Acceptance:
  - Clean Vite production build (`dist/index.html`, `dist/assets/*`).
  - Automated end-to-end verification of the 4-step Section 11 demo script (`backend/tests/test_demo_e2e.py`) passing with zero manual DB edits.
  - Full pytest test suite passes (135 tests).

**Files created/modified:**
- `frontend/package.json` (created)
- `frontend/pnpm-lock.yaml` (created)
- `frontend/vite.config.js` (created)
- `frontend/tailwind.config.js` (created)
- `frontend/postcss.config.js` (created)
- `frontend/index.html` (created)
- `frontend/public/manifest.json` (created)
- `frontend/public/sw.js` (created)
- `frontend/public/audio/telugu/*.wav` (created)
- `frontend/src/index.css` (created)
- `frontend/src/api.js` (created)
- `frontend/src/audioPlayer.js` (created)
- `frontend/src/CameraScannerModal.jsx` (created)
- `frontend/src/CheckScreen.jsx` (created)
- `frontend/src/ResultScreen.jsx` (created)
- `frontend/src/MerchantScreen.jsx` (created)
- `frontend/src/DemoPanelScreen.jsx` (created)
- `frontend/src/MetricsScreen.jsx` (created)
- `frontend/src/App.jsx` (created)
- `frontend/src/main.jsx` (created)
- `backend/app/main.py` (modified)
- `backend/tests/test_api.py` (modified)
- `backend/tests/test_demo_e2e.py` (created)
- `docs/CHANGELOG.md` (modified)

---

### Step 6 — Verdict Fusion & Check API (2026-11-14)

**Plan:**
- Implement hierarchical verdict fusion in `backend/app/fusion.py` (SPEC Section 4.4 and Section 7):
  - Rule 1: Any danger signal -> `DANGER` (hard security checks never averaged away; explanation from highest-scoring danger signal).
  - Rule 2: Else any caution signal -> `CAUTION` (explanation from highest-scoring caution signal).
  - Rule 3: Else if `registry_binding` matches registry -> `VERIFIED`.
  - Rule 4: Else -> `UNVERIFIED` (text-only check returns "No scam signs found. This is not a guarantee.").
  - Formats non-ok detector reasons into `list[ReasonItem]`.
  - Pydantic models: `CheckResponse`, `ReasonItem`, `ExplanationDict`, `FusedVerdict`.
- Populate centralized explanations in `backend/app/config/explanations.yaml` (SPEC Section 5 and Rule 8):
  - Drafted clear English explanations and next steps for every detector outcome.
  - Provided Telugu (`te`) and Hindi (`hi`) translations with native script placeholders marked `[Needs Human Check]`.
  - Safety advice is strictly centralized in YAML; never dynamically generated by LLM.
- Implement Check REST endpoints in `backend/app/main.py` (SPEC Section 4.4):
  - `POST /api/check/qr`: Validates UPI payload, executes lookalike, story link, registry binding, and crowd baseline detectors, records scan event with 3-decimal coarse coordinates, returns fused `CheckResponse`.
  - `POST /api/check/text`: Analyzes suspicious messages using scam text detector, links high-risk payees via story link detector, records message in database, returns fused `CheckResponse`.
  - `POST /api/check/image`: Decodes QR codes via OpenCV headless (running QR check workflow with optional location/shop code parameters), or extracts text via Tesseract OCR (running text check workflow), or returns CAUTION on low confidence / empty image.
- Comprehensive automated testing:
  - `backend/tests/test_fusion.py`: All 4 fusion hierarchy rules, multi-danger highest score selection, text-specific unverified message, multilingual key completeness.
  - `backend/tests/test_api.py`: QR check endpoints (verified, swapped payee danger, lookalike danger, unverified, invalid QR, scan persistence), text check endpoints (scam danger, safe unverified), and image check endpoints (QR image decoding, blank image caution, screenshot OCR).
- Acceptance: Full test suite passes (128 tests) and clean database seed idempotency confirmed.

**Files created/modified:**
- `backend/app/fusion.py` (created)
- `backend/app/config/explanations.yaml` (modified)
- `backend/app/main.py` (modified)
- `backend/tests/test_fusion.py` (created)
- `backend/tests/test_api.py` (created)
- `docs/CHANGELOG.md` (modified)

---

### Step 5 — OCR & Story Link Detectors (2026-11-14)

**Plan:**
- Implement OCR and QR image processing detector in `backend/app/detectors/ocr.py` (SPEC Section 6.7):
  - Decodes QR code images via OpenCV headless (`cv2.QRCodeDetector`) before attempting OCR.
  - Extracts text from screenshots via `pytesseract` with English and Telugu (`lang="eng+tel"`).
  - Calculates word-level confidence and returns user-friendly error asking the user to copy/paste text if image is empty or confidence < 30%.
  - Handles missing OCR binaries or languages gracefully (SPEC Section 16).
  - Returns `Signal` object conforming to SPEC Section 4.2.
- Implement story link detector in `backend/app/detectors/story_link.py` (SPEC Section 6.6):
  - Extracts UPI IDs (letters, digits, dots, hyphens, underscores + @ + letters) and web URLs from analyzed text.
  - Persists payees into `flagged_payees` database table when message score $\ge 0.5$ (`scam_caution`).
  - Increments `report_count` and updates maximum scam score upon repeated detections.
  - On QR check: flags matching payees with `danger` citing the date and first 80 characters of the source message.
- Update `backend/app/models.py`:
  - Enhanced `FlaggedPayee` model with `value`, `kind`, `source_message_id`, `source_message_text`, `score`.
  - Enhanced `Message` model with `score` and `labels_json`.
- Export `ocr` and `story_link` in `backend/app/detectors/__init__.py`.
- Add safety explanations for `flagged_payee_scam_link`, `story_link_ok`, `ocr_qr_decoded`, `ocr_text_extracted`, and `ocr_low_confidence` in `backend/app/config/explanations.yaml`.
- Create comprehensive tests:
  - `backend/tests/test_ocr.py`: QR image decoding with OpenCV encoder/decoder, text screenshot OCR, low confidence / blank image handling, graceful missing Tesseract fallback.
  - `backend/tests/test_story_link.py`: Extraction of UPI IDs and URLs, score threshold condition, citation formatting, deduplication, and full end-to-end acceptance flow from scam message to subsequent QR danger verdict.
- Acceptance: Full test suite passes (110 tests) and clean database seed idempotency confirmed.

**Files created/modified:**
- `backend/app/detectors/ocr.py` (created)
- `backend/app/detectors/story_link.py` (created)
- `backend/tests/test_ocr.py` (created)
- `backend/tests/test_story_link.py` (created)
- `backend/app/models.py` (modified)
- `backend/app/config/explanations.yaml` (modified)
- `backend/app/detectors/__init__.py` (modified)
- `docs/CHANGELOG.md` (modified)

---

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
