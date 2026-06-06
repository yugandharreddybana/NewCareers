"""
ScrapeGraphAI microservice for NewCareers.
Exposes:
  POST /scrape          — generic SmartScraperGraph endpoint
  POST /scrape/jobs     — structured job-listing extractor
  GET  /health          — liveness probe

Start:
  uvicorn main:app --host 0.0.0.0 --port 5500 --reload
"""

import os
import json
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl

from scrapegraphai.graphs import SmartScraperGraph

# ── App setup ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="NewCareers Scraper Service",
    description="AI-powered web scraper powered by ScrapeGraphAI",
    version="1.0.0",
)

ALLOWED_ORIGINS = os.getenv("SCRAPER_ALLOWED_ORIGINS", "http://localhost:4000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── LLM config helper ─────────────────────────────────────────────────────────
def _build_graph_config(timeout: int = 30) -> dict:
    """
    Build the ScrapeGraphAI graph config from environment variables.
    Supports OpenAI (default), Ollama, Groq, Azure, and Gemini.
    """
    model = os.getenv("SCRAPER_LLM_MODEL", "openai/gpt-4o-mini")
    api_key = os.getenv("SCRAPER_LLM_API_KEY", "")

    llm_config: dict = {"model": model}

    # Ollama does not require an API key
    if not model.startswith("ollama/") and api_key:
        llm_config["api_key"] = api_key

    # Optional Ollama base URL override
    ollama_url = os.getenv("OLLAMA_BASE_URL")
    if model.startswith("ollama/") and ollama_url:
        llm_config["base_url"] = ollama_url

    return {
        "llm": llm_config,
        "verbose": os.getenv("SCRAPER_VERBOSE", "false").lower() == "true",
        "headless": True,
        "loader_kwargs": {"timeout": timeout},
    }


# ── Request / Response models ─────────────────────────────────────────────────
class ScrapeRequest(BaseModel):
    url: str
    prompt: str
    timeout: Optional[int] = 30


class JobScrapeRequest(BaseModel):
    url: str
    timeout: Optional[int] = 30


class ScrapeResponse(BaseModel):
    url: str
    result: dict


class PlaywrightJobScrapeRequest(BaseModel):
    url: str
    timeout: Optional[int] = 45
    location: Optional[str] = "Remote"


class PlaywrightJobItem(BaseModel):
    title: str
    url: str
    location: Optional[str] = "Remote"


class PlaywrightJobScrapeResponse(BaseModel):
    url: str
    result: dict


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "service": "scraper"}


@app.post("/scrape", response_model=ScrapeResponse)
async def scrape_generic(body: ScrapeRequest):
    """
    Generic scrape endpoint.
    Send any URL and a natural-language prompt describing what to extract.
    """
    try:
        config = _build_graph_config(timeout=body.timeout)
        graph = SmartScraperGraph(
            prompt=body.prompt,
            source=body.url,
            config=config,
        )
        result = graph.run()
        if not isinstance(result, dict):
            result = {"raw": result}
        return ScrapeResponse(url=body.url, result=result)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/scrape/jobs/playwright", response_model=PlaywrightJobScrapeResponse)
async def scrape_jobs_playwright(body: PlaywrightJobScrapeRequest):
    """
    Deterministic job-listing scrape using Playwright only (no LLM).
    Returns structured jobs with title, url, and location.
    """
    from playwright.async_api import async_playwright

    timeout_ms = max(5, min(body.timeout or 45, 120)) * 1000
    jobs: list[dict] = []

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.goto(body.url, wait_until="networkidle", timeout=timeout_ms)

            selectors = [
                "a[href*='/job/']",
                "a[href*='/jobs/']",
                "a[href*='career']",
                "a[href*='position']",
                "a[href*='vacanc']",
                "[data-automation-id='jobTitle']",
                ".job-title a",
                ".job-listing a",
            ]
            seen: set[str] = set()
            for sel in selectors:
                elements = await page.query_selector_all(sel)
                for el in elements:
                    try:
                        title = (await el.inner_text()).strip()
                        href = await el.get_attribute("href")
                        if not title or len(title) < 4 or len(title) > 160:
                            continue
                        lower = title.lower()
                        if any(x in lower for x in ("cookie", "privacy", "sign in")):
                            continue
                        if not href:
                            continue
                        url = href if href.startswith("http") else page.url.rstrip("/") + "/" + href.lstrip("/")
                        key = title + "|" + url
                        if key in seen:
                            continue
                        seen.add(key)
                        jobs.append({"title": title, "url": url, "location": body.location or "Remote"})
                        if len(jobs) >= 25:
                            break
                    except Exception:
                        continue
                if len(jobs) >= 25:
                    break

            await browser.close()
        return PlaywrightJobScrapeResponse(url=body.url, result={"jobs": jobs})
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/scrape/jobs", response_model=ScrapeResponse)
async def scrape_jobs(body: JobScrapeRequest):
    """
    Job-listing scraper.
    Extracts a structured list of job postings from any careers/jobs page.
    Returns a list of jobs with title, company, location, salary, url, and description.
    """
    job_prompt = (
        "Extract all job listings from this page. "
        "For each job return: title, company, location, salary (if available), "
        "url (direct link to the job), postedDate (if available), "
        "and a brief description (max 200 chars). "
        "Return the result as a JSON object with a key 'jobs' containing a list."
    )
    try:
        config = _build_graph_config(timeout=body.timeout)
        graph = SmartScraperGraph(
            prompt=job_prompt,
            source=body.url,
            config=config,
        )
        result = graph.run()
        if not isinstance(result, dict):
            result = {"jobs": []}
        # Normalise — ensure 'jobs' key always exists
        if "jobs" not in result:
            # Handle case where LLM returned a list directly
            if isinstance(result, list):
                result = {"jobs": result}
            else:
                result = {"jobs": list(result.values())[0] if result else []}
        return ScrapeResponse(url=body.url, result=result)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
