# Multi-stage / Optimized Python 3.11 Backend Container
FROM python:3.11-slim

# Prevent interactive prompts and set Python environment flags
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app/backend:/app

WORKDIR /app

# Install system dependencies:
# - Tesseract OCR with English and Telugu language packs (SPEC 14.1)
# - libgl1 and libglib2.0-0 for headless OpenCV (cv2)
# - curl for Docker healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-tel \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install pinned Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code, configuration, and synthetic data
COPY backend/ ./backend/
COPY data/ ./data/

# Expose FastAPI server port
EXPOSE 8000

# Container healthcheck against /health endpoint
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default command to run backend API server
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
