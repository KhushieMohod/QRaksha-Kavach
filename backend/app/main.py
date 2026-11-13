"""QRaksha-Kavach — FastAPI application entry point."""

from fastapi import FastAPI

app = FastAPI(
    title="QRaksha-Kavach",
    description="Check Before You Pay — scam detection API",
    version="0.1.0",
)


@app.get("/health")
async def health() -> dict[str, str]:
    """Health-check endpoint."""
    return {"status": "ok"}

