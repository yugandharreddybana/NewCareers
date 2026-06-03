# NewCareers Scraper Microservice

AI-powered web scraping service built on [ScrapeGraphAI](https://github.com/ScrapeGraphAI/Scrapegraph-ai).
This service is consumed internally by the Node.js middleware and is **not** exposed directly to the browser.

## Quick Start (local)

**Default:** `mvn spring-boot:run` in `backend/` auto-starts this service on port 5500 — no separate terminal.

One-time Python setup:

```bash
cd scraper
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
```

Optional manual run (debugging):

```bash
uvicorn main:app --host 0.0.0.0 --port 5500 --reload
```

## Quick Start (Docker)

```bash
docker compose up -d scraper
# Use SCRAPER_AUTO_START=false when backend runs outside Docker
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness probe |
| `POST` | `/scrape` | Generic scraper — any URL + custom prompt |
| `POST` | `/scrape/jobs/playwright` | Deterministic Playwright job extractor (no LLM; used by company career fetch) |
| `POST` | `/scrape/jobs` | LLM-based job extractor (admin/legacy; not used by job pipeline) |

### POST `/scrape`

```json
{
  "url": "https://example.com/about",
  "prompt": "Extract company name, mission, and founding year",
  "timeout": 30
}
```

### POST `/scrape/jobs`

```json
{
  "url": "https://careers.example.com/jobs",
  "timeout": 45
}
```

**Response:**
```json
{
  "url": "https://careers.example.com/jobs",
  "result": {
    "jobs": [
      {
        "title": "Senior Software Engineer",
        "company": "Example Corp",
        "location": "Remote",
        "salary": "$120k–$150k",
        "url": "https://careers.example.com/jobs/123",
        "postedDate": "2025-05-10",
        "description": "Build scalable backend systems..."
      }
    ]
  }
}
```

## LLM Provider Configuration

| Provider | `SCRAPER_LLM_MODEL` | `SCRAPER_LLM_API_KEY` |
|----------|---------------------|-----------------------|
| OpenAI | `openai/gpt-4o-mini` | Your OpenAI API key |
| Groq | `groq/llama3-8b-8192` | Your Groq API key |
| Ollama (local) | `ollama/llama3.2` | *(leave blank)* |
| Google Gemini | `google/gemini-pro` | Your Gemini API key |
