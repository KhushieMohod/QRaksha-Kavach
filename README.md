# QRaksha-Kavach

> **"Check Before You Pay"** — A scam-detection Progressive Web App for small merchants, elderly users, and first-time smartphone users.

## Overview

QRaksha-Kavach analyzes suspicious scam content (messages, screenshots, voice notes) alongside payment information (UPI QR codes, UPI IDs) and returns a unified safety verdict with supporting evidence.

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Backend** | Python 3.11, FastAPI, Pydantic, SQLModel, SQLite |
| **Detection** | rapidfuzz, OpenCV (headless), pytesseract, Tesseract OCR |
| **Frontend** | React, Vite, Tailwind CSS, html5-qrcode, PWA |
| **Testing** | pytest |
| **Deployment** | Docker Compose |

## Quick Start

```bash
# 1. Clone & enter
git clone <repo-url> && cd QRaksha-Kavach

# 2. Create virtual environment
python -m venv venv
venv\Scripts\activate   # Windows
# source venv/bin/activate  # macOS/Linux

# 3. Install dependencies
pip install -r requirements.txt

# 4. Copy environment config
cp .env.example .env

# 5. Run tests
pytest

# 6. Start the backend
uvicorn backend.app.main:app --reload
```

## Folder Structure

```
QRaksha-Kavach/
├── backend/
│   ├── app/
│   │   ├── config/       # YAML configs & explanations
│   │   ├── detectors/    # Scam detection modules
│   │   └── main.py       # FastAPI entry point
│   ├── tests/            # pytest test suite
│   └── scripts/          # Utility scripts
├── frontend/             # React PWA (Vite + Tailwind)
├── data/                 # Synthetic/seed data
├── docs/                 # Documentation & changelog
├── requirements.txt      # Pinned Python dependencies
├── pytest.ini            # pytest configuration
├── .env.example          # Environment variable template
└── .gitignore
```

## Environment Variables

See [`.env.example`](.env.example) for all configurable values.

Set `LLM_OFFLINE=1` to run in rules-only mode without an LLM.

## Running Tests

```bash
pytest --tb=short -q
```

## Known Limitations

- This is the initial project skeleton; detection modules and frontend are not yet implemented.

## License

All rights reserved.
