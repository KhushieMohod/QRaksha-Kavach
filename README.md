# QRaksha-Kavach (క్యూఆర్ రక్షా కవచ్ / क्यूआर रक्षा कवच)

> **"Check Before You Pay"** — An accessible scam-detection Progressive Web App (PWA) designed for small merchants, elderly citizens, and first-time smartphone users in Andhra Pradesh and Telangana.

[![CI](https://github.com/user/QRaksha-Kavach/actions/workflows/ci.yml/badge.svg)](https://github.com/user/QRaksha-Kavach/actions)
[![Python 3.11+](https://img.shields.io/badge/python-3.11%2B-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg)](https://fastapi.tiangolo.com)
[![React PWA](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite%20%2B%20Tailwind-61dafb.svg)](https://react.dev)
[![Tests Passing](https://img.shields.io/badge/pytest-156%20passed-success.svg)](backend/tests/)

---

## 1. Overview & Objectives

In India's UPI ecosystem, payment fraud disproportionately targets small kirana store owners and elderly smartphone users through:
- **Physical QR Counter Swaps**: Scammers paste their own QR sticker on top of a shopkeeper's genuine counter code.
- **Brand Lookalike VPAs**: Phishing handles like `sbi.helpdesk@okaxis` or `paytm.refund@ybl`.
- **Cross-Channel Extortion**: "Digital arrest" threats or fake electricity bill disconnection SMS lures that lead directly to a fraud payment address.
- **Malicious APKs**: Fake challan or PM-Kisan APKs demanding device admin or SMS permissions.

**QRaksha-Kavach** solves this by connecting multi-channel evidence (scam text, screenshots, voice notes, and APK metadata) with payment information (UPI QR codes and VPAs) to produce **one deterministic safety verdict** (`VERIFIED`, `UNVERIFIED`, `CAUTION`, `DANGER`) with clear, localized instructions in **English, Telugu, and Hindi**.

---

## 2. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Python 3.11, FastAPI, Pydantic v2, SQLModel, SQLite |
| **Detection Engines** | RapidFuzz (edit distance), OpenCV headless (QR decode), pytesseract (Tesseract OCR `eng+tel`) |
| **Haversine Math** | Pure Python Haversine calculation ($R = 6,371 \text{ km}$) — zero external geo libraries |
| **Frontend** | React 18, Vite, Tailwind CSS, `html5-qrcode` (camera scanner), Web Speech Synthesis API |
| **Audio Accessibility** | Browser Speech Synthesis API + pre-generated Telugu demo WAV audio files |
| **Testing** | pytest (156 automated tests), TestClient, SQLite in-memory fixtures |
| **Packaging** | Docker, Docker Compose, Nginx |

---

## 3. Project Folder Layout

```
QRaksha-Kavach/
├── backend/
│   ├── app/
│   │   ├── config/              # YAML rules, thresholds & multilingual explanations
│   │   ├── detectors/           # 8 modular scam detection engines
│   │   ├── alerts.py            # Merchant alert generation & rate-limiting logic
│   │   ├── database.py          # SQLModel engine & session management
│   │   ├── fusion.py            # Hierarchical risk fusion engine (Danger->Caution->Verified)
│   │   ├── llm.py               # Centralized LLM bridge (temp=0, 8s timeout, SQLite cache)
│   │   ├── main.py              # FastAPI endpoints (/api/check/*, /api/merchant/*, /api/demo/*)
│   │   ├── models.py            # SQLModel database schemas (Merchant, Scan, Alert, etc.)
│   │   └── signals.py           # Standard Signal model contract (SPEC 4.2)
│   ├── scripts/
│   │   ├── evaluate.py          # 30-scenario benchmark & latency evaluation runner
│   │   ├── seed.py              # Single-command synthetic merchant seeding script
│   │   └── simulate_scans.py    # Merchant scan burst & crowd drift simulation utility
│   ├── tests/                   # 156 comprehensive pytest unit & integration tests
│   └── Dockerfile               # Backend container with Tesseract OCR (eng + tel)
├── frontend/
│   ├── public/                  # PWA manifest, service worker & Telugu demo audio files
│   ├── src/                     # React screens (Check, Result, Merchant, Demo, Metrics)
│   ├── nginx.conf               # Nginx reverse proxy configuration for Docker
│   └── Dockerfile               # Multi-stage production build container
├── data/
│   ├── apk_samples.json         # 6 synthetic APK metadata samples (3 harmless, 3 lures)
│   ├── merchants.json           # 20 synthetic kirana shops (KIR-0001 to KIR-0020)
│   ├── messages_labelled.json   # 50 labelled messages (30 dev, 20 held-out)
│   └── scan_scenarios.json      # 30 exact SPEC 8.2 evaluation scenarios
├── docs/
│   ├── architecture.md          # Complete system architecture with Mermaid diagrams
│   ├── extension.md             # 10-minute guide to adding a new Signal detector
│   └── CHANGELOG.md             # Project implementation log & milestones
├── docker-compose.yml           # Multi-container local orchestration
├── requirements.txt             # Pinned Python dependencies
├── pytest.ini                   # Test configuration
└── .env.example                 # Documented environment template
```

---

## 4. Quick Start (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 18+ and pnpm (or npm)
- Tesseract OCR (optional for local image OCR; bundled in Docker)

### Step 1: Clone and Configure Environment

```bash
git clone https://github.com/user/QRaksha-Kavach.git
cd QRaksha-Kavach

# Copy environment template
cp .env.example .env
```

### Step 2: Set Up Python Backend

```bash
# Create and activate virtual environment
python -m venv .venv

# Windows:
.\.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Step 3: Seed the Database (One-Command)

```bash
python backend/scripts/seed.py
```
*Output: `Seed completed: 20 merchants added.` Running this command multiple times is completely idempotent.*

### Step 4: Run the Backend API Server

```bash
uvicorn backend.app.main:app --reload --port 8000
```
Backend API will be running at `http://localhost:8000` (Health check: `http://localhost:8000/health`).

### Step 5: Start the Frontend PWA

In a separate terminal:

```bash
cd frontend
pnpm install
pnpm run dev
```
Open `http://localhost:5173` in your browser. (Switch your browser DevTools to Mobile View for the best PWA experience).

---

## 5. Docker Compose Setup

Run both the backend API and frontend PWA with one command:

```bash
# Build and launch containers
docker compose up --build

# Run in background
docker compose up -d
```

- **Frontend PWA**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000`
- **API Health**: `http://localhost:8000/health`

To seed the database inside the running container:

```bash
docker compose exec backend python backend/scripts/seed.py
```

To stop containers:

```bash
docker compose down
```

---

## 6. Running Tests & Benchmarks

### Run Full Automated Test Suite (156 Tests)

```bash
pytest -v
```

### Run System Benchmark & Latency Evaluation

```bash
python backend/scripts/evaluate.py
```

**Benchmark Results:**
- **30 Scan Scenarios (SPEC 8.2)**: 30 / 30 Passed (**100.0% Accuracy**)
  - Genuine QR at registered shop: 8 / 8 (100%)
  - Swapped counter sticker UPI ID: 6 / 6 (100%)
  - Brand lookalike handle: 4 / 4 (100%)
  - Story-linked payee: 4 / 4 (100%)
  - No registry personal transfer: 4 / 4 (100%)
  - Shop code without GPS: 2 / 2 (100%)
  - Changed payee at unregistered spot: 2 / 2 (100%)
- **Held-Out Scam Messages (20 Messages - Untuned)**:
  - Accuracy: **95.0%**
  - Precision: **100.0%** (0% False Alarms on legitimate bank notices & family chat)
  - Recall: **90.0%**
  - False Positive Rate: **0.0%**
- **Response Latency**: Median **1.29 ms** | 95th Percentile **9.25 ms**

---

## 7. 4-Step Live Demonstration Walkthrough (SPEC Section 11)

You can demonstrate all core defense features in under 3 minutes with zero manual database edits:

### Demo Step 1: Counter QR Swap & Instant Merchant Alert
1. In the PWA **Check** screen, select preset `"KIR-0001 Genuine QR"`. Click **Check**.
   - **Result**: Big green **VERIFIED** badge citing `"Lakshmi Kirana Store (KIR-0001)"`.
2. Open the **Demo Panel** screen and click **"1. Simulate Counter QR Swap"**.
   - An attacker pastes a fraudulent sticker (`scammer.swap@ybl`) over shop KIR-0001's counter.
3. Return to the **Check** screen and scan the swapped code, or switch to the **Merchant** screen:
   - **Result**: Red **DANGER** verdict.
   - The shopkeeper's dashboard immediately displays a high-priority alert with the fraudulent VPA and scan timestamp, allowing them to physically remove the fake sticker.

### Demo Step 2: Cross-Channel Scam Story Linking
1. In the **Demo Panel**, click **"3. Simulate Scam Message with Payee"**.
   - Simulates a victim receiving an urgent digital arrest extortion SMS citing `officer.cbi.investigation@okaxis`.
   - The system scores the text as scam and flags the extracted UPI ID in `FlaggedPayee`.
2. Return to the **Check** screen and scan a QR code paying that same VPA:
   - **Result**: Instant red **DANGER** verdict directly quoting the scam message citation and report date.

### Demo Step 3: Screenshot & Image OCR Verification
1. On the **Check** screen, click **Upload Photo/Screenshot**.
2. Upload a screenshot containing an overdue electricity bill disconnection notice or payment QR:
   - Headless OpenCV decodes the QR or Tesseract OCR extracts text; the fusion engine returns localized warnings and step-by-step guidance.

### Demo Step 4: Metrics Screen & Solution Differentiation
1. Open the **Metrics** screen to view verified evaluation numbers:
   - 100% deterministic scan accuracy across all 30 scenarios.
   - 0.0% false alarms on legitimate bank notices.
   - Sub-10ms response latencies.
2. Review the built-in differentiation slides explaining why physical counter binding and merchant alerting defeat scams that standard payment apps cannot catch.

---

## 8. Honest Pilot Limitations & Assumptions

For transparency and academic/pilot rigor:
1. **Pilot Geometry & Merchant Density**: The registry contains 20 synthetic kirana shops distributed across a 3 km geographic bounding box in Charminar, Hyderabad (`17.3850, 78.4867`). Real-world scale would require state-wide merchant registry onboarding.
2. **Coarse Location Grid**: To protect user privacy, GPS coordinates are permanently rounded to 3 decimal places (~111 meters). The system never tracks continuous paths or exact meter coordinates.
3. **Static APK Triage**: Android APK analysis operates strictly on static metadata JSON (`file_name`, `package_name`, `permissions`, `source`). For security reasons, the system **never downloads, installs, or dynamically executes untrusted binaries**.
4. **Pre-Cached Speech Transcripts**: Audio voice verification uses pre-cached speech transcripts to ensure reliable offline demonstration without external cloud speech API costs.

---

## 9. AI-Use Disclosure

In accordance with academic transparency and responsible AI development guidelines:
- **Assisted Scaffolding**: Code scaffolding, test case generation, and documentation formatting were assisted by Antigravity (Google DeepMind agentic assistant) operating under the strict **Sovereign Command Protocol** and constitutional rules in `AGENTS.md`.
- **Zero AI Hallucination in Safety Advice**: All user-facing explanations, warnings, and emergency next steps are strictly loaded from `backend/app/config/explanations.yaml`. The LLM is **never** permitted to dynamically draft user safety instructions.
- **Rules-Only Offline Guarantee**: The system operates with 100% functionality under `LLM_OFFLINE=1`. All pattern matching, Haversine spatial lookups, and risk fusion rules execute deterministically.

---

## 10. Documentation Links

- [System Architecture & Diagrams](docs/architecture.md)
- [How to Add a Detector in ~10 Minutes](docs/extension.md)
- [Project Changelog & Milestones](docs/CHANGELOG.md)

---

## 11. License

All rights reserved. Developed for public defense against digital financial fraud in Andhra Pradesh and Telangana.
