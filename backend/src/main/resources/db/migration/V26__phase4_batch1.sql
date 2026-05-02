-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 4 Batch 1 — Watchlists, Career Memory, Resume Versions
-- ─────────────────────────────────────────────────────────────────────────────

-- 4.1 Task 1 — job_watchlists
CREATE TABLE IF NOT EXISTS job_watchlists (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                 VARCHAR(255) NOT NULL,
  query_keywords       TEXT,
  location             VARCHAR(255),
  min_salary           INTEGER,
  max_salary           INTEGER,
  remote_only          BOOLEAN     NOT NULL DEFAULT false,
  sponsorship_required BOOLEAN     NOT NULL DEFAULT false,
  min_match_score      SMALLINT    NOT NULL DEFAULT 0,
  alert_email          BOOLEAN     NOT NULL DEFAULT true,
  alert_in_app         BOOLEAN     NOT NULL DEFAULT true,
  status               VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
  last_run_at          TIMESTAMPTZ,
  matched_total        INTEGER     NOT NULL DEFAULT 0,
  clicked_total        INTEGER     NOT NULL DEFAULT 0,
  applied_total        INTEGER     NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_watchlists_user   ON job_watchlists(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlists_status ON job_watchlists(user_id, status);

-- 4.1 Task 2 — watchlist_runs
CREATE TABLE IF NOT EXISTS watchlist_runs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id   UUID        NOT NULL REFERENCES job_watchlists(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  matched_count  INTEGER     NOT NULL DEFAULT 0,
  new_count      INTEGER     NOT NULL DEFAULT 0,
  job_ids        JSONB       NOT NULL DEFAULT '[]',
  run_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_watchlist_runs_wl   ON watchlist_runs(watchlist_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_runs_user ON watchlist_runs(user_id);

-- 4.3 Task 37 — career_memories
CREATE TABLE IF NOT EXISTS career_memories (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category        VARCHAR(100) NOT NULL,
  key             VARCHAR(255) NOT NULL,
  value           TEXT        NOT NULL,
  source          VARCHAR(100),
  why_suggested   TEXT,
  confidence      SMALLINT    NOT NULL DEFAULT 80 CHECK (confidence BETWEEN 0 AND 100),
  memory_enabled  BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, category, key)
);

CREATE INDEX IF NOT EXISTS idx_memories_user     ON career_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_category ON career_memories(user_id, category);

-- 4.3 Task 38 — memory_embeddings (vector-ready placeholder)
CREATE TABLE IF NOT EXISTS memory_embeddings (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id      UUID        NOT NULL REFERENCES career_memories(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  embedding_text TEXT        NOT NULL,
  vector_json    JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mem_embeddings_memory ON memory_embeddings(memory_id);
CREATE INDEX IF NOT EXISTS idx_mem_embeddings_user   ON memory_embeddings(user_id);

-- 4.5 Task 67 — resume_versions
CREATE TABLE IF NOT EXISTS resume_versions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                VARCHAR(255) NOT NULL,
  version_number      INTEGER     NOT NULL DEFAULT 1,
  source              VARCHAR(100) NOT NULL DEFAULT 'manual',
  role_tags           TEXT[]      NOT NULL DEFAULT '{}',
  is_active           BOOLEAN     NOT NULL DEFAULT false,
  is_favorite         BOOLEAN     NOT NULL DEFAULT false,
  outcome_association VARCHAR(100),
  interview_count     INTEGER     NOT NULL DEFAULT 0,
  application_count   INTEGER     NOT NULL DEFAULT 0,
  offer_count         INTEGER     NOT NULL DEFAULT 0,
  best_for_role_type  VARCHAR(255),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resume_versions_user ON resume_versions(user_id);

-- 4.5 Task 68 — resume_version_assets
CREATE TABLE IF NOT EXISTS resume_version_assets (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id       UUID        NOT NULL REFERENCES resume_versions(id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_type       VARCHAR(50) NOT NULL DEFAULT 'pdf',
  storage_key      VARCHAR(500),
  file_size_bytes  INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rv_assets_version ON resume_version_assets(version_id);
