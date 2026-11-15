# QRaksha-Kavach

QRaksha-Kavach is a privacy-conscious progressive web application that helps people check UPI payment QR codes and related scam signals before paying. It is designed for merchants, older adults, and first-time smartphone users.

The application combines information from QR codes, payment IDs, messages, screenshots, optional voice notes, and static APK metadata. It returns one of four risk verdicts: `VERIFIED`, `UNVERIFIED`, `CAUTION`, or `DANGER`, with evidence and predefined explanations.

## Features

- Scan a UPI QR code with a camera, paste a UPI payment link, or upload a QR image.
- Check suspicious messages and screenshots.
- Check optional voice notes and static APK metadata.
- Compare payment IDs with registered synthetic merchant records.
- Detect suspicious payment handles, scam-message patterns, and links between reported scam messages and payment IDs.
- Show merchant alerts and aggregate scan metrics.
- Use English, Telugu, and Hindi interface text.
- Play pre-recorded Telugu verdict audio when available.
- Run deterministic, rules-only checks without an LLM.

## How It Works

The React application sends requests to a FastAPI backend. Independent detectors examine the submitted information and return structured signals. The risk-fusion layer combines those signals into a verdict. User-facing safety explanations and recommended actions are loaded from `backend/app/config/explanations.yaml`; the LLM does not write safety advice.

The application does not need an LLM to perform rules-based checks. APK checks process only supplied static metadata; APK files are never installed or executed.

## Technology

- **Backend:** Python 3.11, FastAPI, Pydantic, SQLModel, SQLite
- **Detection:** RapidFuzz, OpenCV, pytesseract, and Tesseract OCR
- **Frontend:** React, Vite, Tailwind CSS, `html5-qrcode`
- **Packaging:** Docker, Docker Compose, and Nginx
- **Tests:** pytest

## Project Structure

```text
backend/
  app/
    config/       YAML rules, thresholds, and explanations
    detectors/    QR, OCR, message, handle, registry, and APK checks
    main.py       FastAPI endpoints
    fusion.py     Risk-signal fusion and verdict selection
    models.py     Database models
    signals.py    Detector signal model
  scripts/        Database seeding and evaluation tools
  tests/          Backend and API tests
frontend/
  public/         PWA assets and Telugu audio files
  src/            React screens and API client
data/             Synthetic merchants, messages, and scenarios
docs/             Project architecture and development guides
docker-compose.yml
requirements.txt
```

## Run Locally

### Requirements

- Python 3.11
- Node.js and pnpm
- Tesseract OCR for local image OCR; the backend Docker image includes English and Telugu language data

### Install and seed

Run these commands from the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pnpm --dir frontend install
python backend/scripts/seed.py
```

The seed script adds synthetic merchants and can be run again without duplicating them.

### Start the backend

From the repository root, in one terminal:

```powershell
$env:LLM_OFFLINE = "1"
python -m uvicorn app.main:app --app-dir backend --reload --port 8000
```

The API is available at `http://localhost:8000`. Its health endpoint is `http://localhost:8000/health`.

### Start the frontend

In another terminal:

```powershell
pnpm --dir frontend run dev
```

Open `http://localhost:5173`.

## Run with Docker Compose

From the repository root:

```powershell
docker compose up --build
```

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- Health check: `http://localhost:8000/health`

Seed synthetic merchant data in the running backend container:

```powershell
docker compose exec backend python backend/scripts/seed.py
```

Stop the services with:

```powershell
docker compose down
```

## API Endpoints

- `GET /health` — service health
- `GET /api/merchants` — registered merchants
- `POST /api/merchant/register` — register a merchant
- `GET /api/merchant/{id}/alerts` — merchant alerts
- `POST /api/check/qr` — check a UPI payment link
- `POST /api/check/text` — check message text
- `POST /api/check/image` — check an uploaded image
- `POST /api/check/apk-meta` — check static APK metadata
- `POST /api/check/voice` — check an uploaded voice note
- `POST /api/demo/simulate` — run a demonstration simulation
- `GET /api/metrics` — aggregate metrics

## Configuration and Privacy

Copy `.env.example` to `.env` to review the available settings. Set `LLM_OFFLINE=1` to disable LLM calls and use deterministic rules only. Keep real API keys and secrets out of source control.

The project uses synthetic merchant and demonstration data. It does not need UPI PINs, OTPs, passwords, or exact GPS coordinates. Location data used for merchant matching is stored at reduced precision.

Detection rules and thresholds are stored in `backend/app/config/`. User-facing explanations and recommendations are stored in `backend/app/config/explanations.yaml`.

## Tests and Evaluation

Run the backend and integration tests from the repository root:

```powershell
pytest
```

Build the frontend:

```powershell
pnpm --dir frontend run build
```

Run the scenario evaluation:

```powershell
python backend/scripts/evaluate.py
```

## Limitations

- Merchant and evaluation data are synthetic and are not a live payment-provider or nationwide merchant registry.
- A `VERIFIED` verdict is based on the available registry and signals; users should still confirm the recipient shown by their payment app.
- Local image OCR requires a working Tesseract installation with the needed language data.
- Telugu verdict audio files are included, but their spoken wording has not been independently verified against the configured Telugu explanations.
- APK triage is limited to static metadata supplied as JSON.
