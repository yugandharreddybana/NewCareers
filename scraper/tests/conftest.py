"""pytest configuration for scraper tests."""
import os
import pytest

@pytest.fixture(autouse=True)
def _scraper_env(monkeypatch):
    """Set minimal env vars so server.ts env-validation does not fire."""
    monkeypatch.setenv("SCRAPER_LLM_MODEL", "openai/gpt-4o-mini")
    monkeypatch.setenv("SCRAPER_LLM_API_KEY", "sk-test-ci")
    monkeypatch.setenv("SCRAPER_ALLOWED_ORIGINS", "http://localhost:4000")
