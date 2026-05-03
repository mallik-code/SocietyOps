# ─────────────────────────────────────────────
# Stage 1 — dependency builder
# ─────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /build

# 1. Install shared dependencies
COPY microservice-dependencies /tmp/microservice-dependencies
RUN cd /tmp/microservice-dependencies && \
  cp pyproject.template.toml pyproject.toml && \
  sed -i "s/\$SOCIETYOPS_DEPENDENCIES_PACKAGE_VERSION/1.0.0/g" pyproject.toml && \
  pip install --prefix=/install .

# 2. Install service-specific dependencies
COPY complaint-service/requirements.txt .
RUN pip install --upgrade pip \
  && pip install --prefix=/install --no-cache-dir -r requirements.txt

# ─────────────────────────────────────────────
# Stage 2 — runtime image
# ─────────────────────────────────────────────
FROM python:3.12-slim

LABEL maintainer="your-team@example.com"
LABEL description="WhatsApp Complaint Management API (FastAPI + SQLite)"

ENV PYTHONDONTWRITEBYTECODE=1 \
  PYTHONUNBUFFERED=1 \
  LOG_LEVEL=INFO \
  DATABASE_URL=sqlite:////app/data/complaints.db

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY complaint-service/app/ ./app/

# Persistent volume mount point for the SQLite file
RUN mkdir -p /app/data

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
