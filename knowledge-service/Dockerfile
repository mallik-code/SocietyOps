FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 1. Copy and install shared dependencies first (for caching)
COPY microservice-dependencies /tmp/microservice-dependencies
RUN cd /tmp/microservice-dependencies && \
    cp pyproject.template.toml pyproject.toml && \
    sed -i "s/\$SOCIETYOPS_DEPENDENCIES_PACKAGE_VERSION/1.0.0/g" pyproject.toml && \
    pip install .

# 2. Install service-specific dependencies
COPY knowledge-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 3. Copy application code
COPY knowledge-service/ .

# Environment variables with defaults
ENV PORT=8000
ENV LOG_LEVEL=INFO
ENV SQL_ECHO=false

# Expose port
EXPOSE 8000

# Start command
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
