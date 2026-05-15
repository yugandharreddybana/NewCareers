# ── Stage: runtime ───────────────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# System deps needed by Playwright / Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget gnupg ca-certificates curl \
    libglib2.0-0 libnss3 libnspr4 libdbus-1-3 \
    libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libxkbcommon0 libatspi2.0-0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers (Chromium only for minimal image size)
RUN playwright install chromium
RUN playwright install-deps chromium

COPY . .

# Disable ScrapeGraphAI anonymous telemetry inside container
ENV SCRAPEGRAPHAI_TELEMETRY_ENABLED=false

EXPOSE 5500

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5500"]
