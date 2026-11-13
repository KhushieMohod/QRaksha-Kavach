
# QRaksha-Kavach — Technical Specification

## 13. Project Overview

QRaksha-Kavach is a "Check Before You Pay" Progressive Web Application (PWA) designed for small merchants, elderly users, and first-time smartphone users in Andhra Pradesh and Telangana.

The application connects suspicious scam content (messages, screenshots, and optional voice notes) with payment information (UPI QR codes and UPI IDs).

Its primary objective is to analyze the available evidence and return one unified safety verdict with supporting evidence.

The system must be simple, accessible, privacy-conscious, and functional even when the LLM is unavailable.

## 14. Fixed Technical Decisions

The following technology choices are fixed. Do not replace them or introduce alternatives without explicit approval.

### 14.1 Backend

- Python 3.11
- FastAPI for backend APIs.
- Pydantic for data validation and structured models.
- SQLModel for database models and SQLite integration.
- SQLite as the database.
- pytest for automated testing.
- PyYAML for YAML configuration management.
- rapidfuzz for fuzzy string matching.
- OpenCV (headless) for QR image processing and decoding.
- pytesseract for OCR.
- Tesseract OCR with English and Telugu language support.

Additional backend requirements:

- Implement the Haversine distance calculation directly in Python.
- Do not introduce an external geographic or distance-calculation library.
- Keep API routes, services, detectors, database models, and configuration handling modular.
- Validate all incoming API data.
- Use type hints and Pydantic models consistently.

### 14.2 LLM Integration

- All LLM interactions must happen exclusively through `app/llm.py`.
- Support a hosted LLM API through a centralized integration.
- Use an SQLite database table to cache LLM responses.
- Set the LLM request timeout to 8 seconds.
- Use temperature 0 for deterministic responses.
- Implement a rules-only fallback when the LLM is unavailable.
- Support the environment variable `LLM_OFFLINE=1` to disable LLM calls completely.
- When offline mode is enabled, all relevant detection must continue using deterministic rules.
- Never allow LLM-generated safety advice.
- Validate and structure all LLM responses before using them.

### 14.3 Frontend

Use the following fixed frontend technologies:

- React for the user interface.
- Vite as the frontend build tool.
- Tailwind CSS for styling.
- Progressive Web App (PWA) support for installation.
- `html5-qrcode` for QR code scanning.
- Browser Speech Synthesis API for spoken safety verdicts.
- Pre-generated Telugu audio files for the demonstration.

Frontend requirements:

- Keep the interface simple and accessible.
- Design for elderly and first-time smartphone users.
- Use clear labels, readable text, and easily distinguishable safety verdicts.
- Support mobile-first responsive layouts.
- Provide clear loading, error, and offline states.
- Never expose API keys, secrets, or database credentials in frontend code.
- Do not collect exact GPS coordinates.
- Use synthetic or appropriately generalized location data for location-based demonstrations.
- Ensure spoken verdicts use predefined safety explanations rather than dynamically generated LLM advice.

### 14.4 Packaging and Deployment

Use Docker Compose for local development and deployment.

The project must include:

- Backend Docker configuration.
- Frontend Docker configuration.
- `docker-compose.yml` for running both services.
- `.env.example` containing documented environment variable names and safe example values.
- A single documented command to seed the SQLite database with synthetic merchant and demonstration data.

Deployment requirements:

- Do not commit real API keys or secrets.
- Do not commit real customer or merchant information.
- Ensure the application can run in rules-only offline mode.
- Document the startup and database-seeding commands in the README.

## 15. Folder Layout

Follow the folder layout defined in `SPEC.md`.

Do not arbitrarily create, rename, move, or reorganize project directories.

If the folder layout is not yet defined or a required directory is missing, propose the necessary structure in the implementation plan and wait for approval before creating it.

## 16. Implementation Rules for These Technologies

- Use FastAPI dependency injection where appropriate.
- Use SQLModel for database persistence.
- Keep database access separate from detection logic.
- Store configurable detection rules and thresholds in YAML files under `app/config/`.
- Store all user-facing safety explanations in `app/config/explanations.yaml`.
- Keep QR decoding, OCR, scam detection, UPI validation, location checks, and risk fusion as separate modules.
- Every detector must return the `Signal` object defined in Section 4.2.
- Write corresponding tests for every detector.
- Use synthetic data for database seeding and automated tests.
- Keep the frontend and backend communication through documented REST APIs.
- Handle missing OCR languages, unavailable cameras, invalid QR codes, and network failures gracefully.
- Do not assume that browser speech synthesis supports Telugu on every device. Use the pre-generated Telugu audio files as a fallback.

## 17. Important Privacy and Safety Constraints

- Never collect or store UPI PINs, OTPs, passwords, or authentication credentials.
- Never collect or store exact GPS coordinates.
- Never execute or install APK files.
- APK triage must only analyze static metadata supplied as JSON.
- Do not write malware, exploits, or code that attacks external systems.
- Use synthetic data exclusively for development, testing, and demonstrations.
- Do not claim that a QR code, merchant, or payment is verified unless the implemented verification mechanism supports that claim.
- Treat GPS proximity as supporting evidence, never as proof of merchant identity.

## 18. Documentation Requirements

Maintain a clear README documenting:

- Project overview and objectives.
- Technology stack.
- Folder structure.
- Installation instructions.
- Environment configuration.
- Database seeding command.
- Backend startup command.
- Frontend startup command.
- Docker Compose instructions.
- Offline mode configuration.
- Test execution instructions.
- Known limitations and assumptions.

Update documentation only when relevant to the approved task.

## 19. Final Development Rule

All technical decisions in this specification are fixed unless the user explicitly approves a change.

Before implementing any new feature:

1. Read `SPEC.md`.
2. Inspect the relevant existing files.
3. Explain the implementation approach.
4. Identify the exact files that need modification.
5. Wait for explicit approval.
6. Implement only the approved step.
7. Test the implementation.
8. Report the actual results.

Do not silently change the architecture, technology stack, folder layout, or security constraints.