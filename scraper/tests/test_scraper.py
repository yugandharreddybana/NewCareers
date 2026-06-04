"""
Batch 6 — Unit tests for the FastAPI scraper service.

Tests are fully offline: all HTTP and SmartScraperGraph calls are mocked
so the suite runs in CI without any external credentials or network access.

Coverage:
  T1  _build_graph_config — default (OpenAI), Ollama, explicit key
  T2  /health endpoint
  T3  /scrape — happy path, SmartScraperGraph error → HTTP 500
  T4  /scrape/jobs — happy path, non-dict result normalised, error → 500
  T5  /scrape/jobs/playwright — happy path, timeout → 500
"""

import os
import sys
import types
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# ---------------------------------------------------------------------------
# Stub heavy optional deps before importing main so the test runner does not
# need playwright, scrapegraphai, or a real browser installed.
# ---------------------------------------------------------------------------
def _make_stub(name: str) -> types.ModuleType:
    mod = types.ModuleType(name)
    sys.modules[name] = mod
    return mod

# scrapegraphai stubs
sga = _make_stub("scrapegraphai")
sga_graphs = _make_stub("scrapegraphai.graphs")
class _FakeSmartScraperGraph:
    def __init__(self, **_kwargs): pass
    def run(self): return {"jobs": []}
sga_graphs.SmartScraperGraph = _FakeSmartScraperGraph

# playwright stubs
for mod_name in ["playwright", "playwright.async_api"]:
    _make_stub(mod_name)

# Now safe to import the app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from main import app, _build_graph_config  # noqa: E402

from fastapi.testclient import TestClient
client = TestClient(app)


# ===========================================================================
# T1 — _build_graph_config
# ===========================================================================
class TestBuildGraphConfig:
    def test_default_uses_openai(self, monkeypatch):
        monkeypatch.delenv("SCRAPER_LLM_MODEL", raising=False)
        monkeypatch.setenv("SCRAPER_LLM_API_KEY", "sk-test")
        cfg = _build_graph_config()
        assert cfg["llm"]["model"] == "openai/gpt-4o-mini"
        assert cfg["llm"]["api_key"] == "sk-test"

    def test_ollama_skips_api_key(self, monkeypatch):
        monkeypatch.setenv("SCRAPER_LLM_MODEL", "ollama/llama3")
        monkeypatch.setenv("OLLAMA_BASE_URL", "http://localhost:11434")
        cfg = _build_graph_config()
        assert "api_key" not in cfg["llm"]
        assert cfg["llm"]["base_url"] == "http://localhost:11434"

    def test_custom_timeout_propagated(self, monkeypatch):
        monkeypatch.setenv("SCRAPER_LLM_MODEL", "openai/gpt-4o")
        monkeypatch.setenv("SCRAPER_LLM_API_KEY", "sk-x")
        cfg = _build_graph_config(timeout=60)
        assert cfg["loader_kwargs"]["timeout"] == 60


# ===========================================================================
# T2 — /health
# ===========================================================================
class TestHealth:
    def test_returns_ok(self):
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"
        assert r.json()["service"] == "scraper"


# ===========================================================================
# T3 — POST /scrape
# ===========================================================================
class TestScrapeGeneric:
    def test_happy_path(self):
        mock_graph = MagicMock()
        mock_graph.run.return_value = {"key": "value"}
        with patch("main.SmartScraperGraph", return_value=mock_graph):
            r = client.post("/scrape", json={"url": "https://example.com", "prompt": "Extract titles"})
        assert r.status_code == 200
        body = r.json()
        assert body["url"] == "https://example.com"
        assert body["result"] == {"key": "value"}

    def test_non_dict_result_wrapped(self):
        mock_graph = MagicMock()
        mock_graph.run.return_value = ["item1", "item2"]  # list, not dict
        with patch("main.SmartScraperGraph", return_value=mock_graph):
            r = client.post("/scrape", json={"url": "https://example.com", "prompt": "p"})
        assert r.status_code == 200
        assert "raw" in r.json()["result"]

    def test_graph_exception_returns_500(self):
        mock_graph = MagicMock()
        mock_graph.run.side_effect = RuntimeError("LLM timeout")
        with patch("main.SmartScraperGraph", return_value=mock_graph):
            r = client.post("/scrape", json={"url": "https://example.com", "prompt": "p"})
        assert r.status_code == 500
        assert "LLM timeout" in r.json()["detail"]


# ===========================================================================
# T4 — POST /scrape/jobs
# ===========================================================================
class TestScrapeJobs:
    def test_happy_path_returns_jobs_key(self):
        mock_graph = MagicMock()
        mock_graph.run.return_value = {"jobs": [{"title": "SWE", "company": "Acme"}]}
        with patch("main.SmartScraperGraph", return_value=mock_graph):
            r = client.post("/scrape/jobs", json={"url": "https://jobs.example.com"})
        assert r.status_code == 200
        assert r.json()["result"]["jobs"][0]["title"] == "SWE"

    def test_normalises_missing_jobs_key(self):
        """LLM sometimes returns {"listings": [...]} — must be normalised."""
        mock_graph = MagicMock()
        mock_graph.run.return_value = {"listings": [{"title": "Dev"}]}
        with patch("main.SmartScraperGraph", return_value=mock_graph):
            r = client.post("/scrape/jobs", json={"url": "https://jobs.example.com"})
        assert r.status_code == 200
        # normalisation promotes first value to jobs list
        assert isinstance(r.json()["result"]["jobs"], list)

    def test_llm_list_result_normalised(self):
        mock_graph = MagicMock()
        mock_graph.run.return_value = [{"title": "QA"}]  # bare list
        with patch("main.SmartScraperGraph", return_value=mock_graph):
            r = client.post("/scrape/jobs", json={"url": "https://jobs.example.com"})
        assert r.status_code == 200
        assert r.json()["result"]["jobs"] == [{"title": "QA"}]

    def test_error_returns_500(self):
        mock_graph = MagicMock()
        mock_graph.run.side_effect = Exception("network error")
        with patch("main.SmartScraperGraph", return_value=mock_graph):
            r = client.post("/scrape/jobs", json={"url": "https://jobs.example.com"})
        assert r.status_code == 500


# ===========================================================================
# T5 — POST /scrape/jobs/playwright
# ===========================================================================
class TestPlaywrightScrape:
    def _make_pw_mock(self, jobs: list[dict]):
        """Build a minimal async-playwright mock tree."""
        el_mocks = []
        for job in jobs:
            el = AsyncMock()
            el.inner_text = AsyncMock(return_value=job["title"])
            el.get_attribute = AsyncMock(return_value=job["href"])
            el_mocks.append(el)

        page = AsyncMock()
        page.url = "https://jobs.example.com"
        page.goto = AsyncMock()
        page.query_selector_all = AsyncMock(return_value=el_mocks)

        browser = AsyncMock()
        browser.new_page = AsyncMock(return_value=page)
        browser.close = AsyncMock()

        chromium = AsyncMock()
        chromium.launch = AsyncMock(return_value=browser)

        pw_instance = AsyncMock()
        pw_instance.chromium = chromium
        pw_instance.__aenter__ = AsyncMock(return_value=pw_instance)
        pw_instance.__aexit__ = AsyncMock(return_value=False)

        pw_ctx = MagicMock()
        pw_ctx.return_value = pw_instance
        return pw_ctx

    def test_happy_path_returns_jobs(self):
        pw_ctx = self._make_pw_mock([
            {"title": "Backend Engineer", "href": "https://jobs.example.com/1"},
            {"title": "Frontend Engineer", "href": "https://jobs.example.com/2"},
        ])
        with patch("main.async_playwright", pw_ctx):
            r = client.post("/scrape/jobs/playwright", json={"url": "https://jobs.example.com"})
        assert r.status_code == 200
        assert len(r.json()["result"]["jobs"]) >= 1

    def test_short_title_filtered_out(self):
        """Titles shorter than 4 chars must be dropped."""
        pw_ctx = self._make_pw_mock([
            {"title": "OK", "href": "https://jobs.example.com/x"},  # 2 chars — filtered
            {"title": "Good Title Here", "href": "https://jobs.example.com/y"},
        ])
        with patch("main.async_playwright", pw_ctx):
            r = client.post("/scrape/jobs/playwright", json={"url": "https://jobs.example.com"})
        assert r.status_code == 200
        titles = [j["title"] for j in r.json()["result"]["jobs"]]
        assert "OK" not in titles

    def test_playwright_exception_returns_500(self):
        pw_ctx = MagicMock()
        pw_instance = AsyncMock()
        pw_instance.__aenter__ = AsyncMock(side_effect=RuntimeError("browser crash"))
        pw_instance.__aexit__ = AsyncMock(return_value=False)
        pw_ctx.return_value = pw_instance
        with patch("main.async_playwright", pw_ctx):
            r = client.post("/scrape/jobs/playwright", json={"url": "https://jobs.example.com"})
        assert r.status_code == 500
