# Shoot4Fun backend - the WebSocket-authoritative match server.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY backend/pyproject.toml /app/
COPY backend/shoot4fun_backend /app/shoot4fun_backend

RUN pip install --upgrade pip && pip install /app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=2).read()" || exit 1

CMD ["uvicorn", "shoot4fun_backend.adapters.inbound.http.app:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
