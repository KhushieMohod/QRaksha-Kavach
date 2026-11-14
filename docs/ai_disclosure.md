# AI Tools & External Code Disclosure

This document provides a full, transparent disclosure of all artificial intelligence (AI) tools, external libraries, and third-party code utilized in the design, implementation, and evaluation of **QRaksha-Kavach**.

---

## 1. AI Tools Utilized

| Tool / Model | Provider | Model Version | Exact Purpose in Project |
| :--- | :--- | :--- | :--- |
| **Antigravity AI Agent** | Google DeepMind | Gemini 2.5 / Flash | Code scaffolding, rapid test case generation, documentation synthesis, and terminal execution under strict human instruction. |
| **Google Gemini API** *(Optional)* | Google Cloud | `gemini-1.5-flash` | Centralized text classification fallback in `app/llm.py` (strictly gated to evidence extraction; operates with temperature 0, 8s timeout, and SQLite cache). |

### Governance & Constitutional Guardrails
All AI interactions operated under the strict **Sovereign Command Protocol** and constitutional rules defined in `AGENTS.md`:
1. **Never Hallucinate Safety Advice**: The AI assistant was strictly forbidden from dynamically generating user-facing safety advice. All safety messages, warnings, and next steps are hardcoded in `backend/app/config/explanations.yaml`.
2. **Never Weaken Hard Rules**: AI-generated code could not average away danger signals. Hierarchical fusion strictly enforces that any danger signal triggers a `DANGER` verdict.
3. **No Dynamic Execution of Malware**: Static APK triage was restricted to JSON metadata analysis; the agent was forbidden from writing dynamic binary analyzers or exploit scripts.
4. **Offline First**: The application was required to remain 100% functional with `LLM_OFFLINE=1`.

---

## 2. External Code & Third-Party Dependencies

All dependencies are explicitly pinned in `requirements.txt` (backend) and `frontend/package.json` (frontend) with zero unvetted packages.

### Backend Dependencies (`requirements.txt`)

| Package | Version | License | Justification & Responsibility |
| :--- | :--- | :--- | :--- |
| **fastapi** | `0.115.6` | MIT | High-performance, type-annotated REST API framework. |
| **uvicorn** | `0.34.0` | BSD-3-Clause | Production-grade ASGI server for FastAPI. |
| **pydantic** | `2.10.4` | MIT | Structured data models, validation, and serialization (`Signal`, `CheckResponse`). |
| **sqlmodel** | `0.0.22` | MIT | Combines SQLAlchemy with Pydantic for clean SQLite persistence. |
| **pytest** | `8.3.4` | MIT | Automated test framework executing our 156-test regression suite. |
| **pyyaml** | `6.0.2` | MIT | Configuration loader for `rules.yaml`, `thresholds.yaml`, and `explanations.yaml`. |
| **rapidfuzz** | `3.11.0` | MIT | C++ accelerated Levenshtein string matching for lookalike brand typos. |
| **opencv-python-headless** | `4.10.0.84` | Apache 2.0 | Headless computer vision library for fast embedded QR code decoding. |
| **pytesseract** | `0.3.13` | Apache 2.0 | Python wrapper for Tesseract OCR to read text from screenshot uploads. |
| **python-multipart** | `0.0.20` | Apache 2.0 | Streaming multi-part form data parser for image file uploads. |
| **httpx** | `0.28.1` | BSD-3-Clause | Synchronous and asynchronous HTTP client for testing and API calls. |

### System Packages & OCR Engines
- **Tesseract OCR Engine** (`tesseract-ocr`): Open-source optical character recognition engine.
- **English Language Pack** (`tesseract-ocr-eng`): OCR training data for English text.
- **Telugu Language Pack** (`tesseract-ocr-tel`): OCR training data for native Telugu script text.

### Frontend Dependencies (`frontend/package.json`)

| Package | Version | License | Justification & Responsibility |
| :--- | :--- | :--- | :--- |
| **react** | `^18.3.1` | MIT | Component-based UI library. |
| **react-dom** | `^18.3.1` | MIT | DOM rendering engine for React. |
| **vite** | `^5.4.2` | MIT | Ultra-fast frontend bundler and development server. |
| **tailwindcss** | `^3.4.1` | MIT | Utility-first CSS framework for tactile, high-contrast UI design. |
| **html5-qrcode** | `^2.3.8` | Apache 2.0 | Client-side camera QR code scanning engine. |
| **lucide-react** | `^0.475.0` | ISC | Accessible, lightweight icon pack for mobile interface. |

---

## 3. Human Authorship & Review Statement

- **Core System Architecture**: Designed and specified by the human engineering team.
- **Rules & Vocabulary**: The 11 scam categories, transliterated Hindi/Telugu keywords, brand lists, and NPCI handle suffixes were curated and tuned on ground-truth scam samples.
- **Safety Explanations**: Written and reviewed by humans specifically for low-literacy and elderly smartphone users in Andhra Pradesh and Telangana.
- **Verification**: 100% of all code was verified through automated pytest test suites (156 passing tests), benchmark runners, and clean database idempotency checks before committing.
