-- V100 — Multi-year employment permit analytics (enterprise.gov.ie, 2009–2026)
-- Ingestion snapshots, dimensional facts (companies/sectors/counties), cross-year
-- reliability scoring, domain→sector mapping seeds, and per-user watchlists.
SET search_path TO careerops;

-- ─────────────────────────────────────────────────────────────────────────────
-- permit_snapshots — one ingestion run per calendar year
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE permit_snapshots (
    id                    BIGSERIAL PRIMARY KEY,
    source_year           INT NOT NULL,                          -- 2009 … 2026
    is_full_year          BOOLEAN NOT NULL DEFAULT false,        -- completed vs live/partial year
    fetched_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active             BOOLEAN NOT NULL DEFAULT true,         -- canonical row for this year
    source_url            TEXT NOT NULL,
    row_count_companies   INT DEFAULT 0,
    row_count_sectors     INT DEFAULT 0,
    row_count_counties    INT DEFAULT 0,
    CONSTRAINT uq_permit_snapshots_year_active
        UNIQUE (source_year, is_active) DEFERRABLE INITIALLY DEFERRED
);

COMMENT ON TABLE permit_snapshots IS
    'Metadata for each enterprise.gov.ie permit dataset import; one active snapshot per year.';
COMMENT ON COLUMN permit_snapshots.is_full_year IS
    'True when the source year is closed and monthly breakdowns are complete.';
COMMENT ON COLUMN permit_snapshots.is_active IS
    'Marks the snapshot used for queries; deactivate prior rows when re-ingesting.';

-- ─────────────────────────────────────────────────────────────────────────────
-- permit_companies — employer-level permits per snapshot
-- Monthly columns nullable: 2009–2018 sources may only publish annual totals.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE permit_companies (
    id                       BIGSERIAL PRIMARY KEY,
    snapshot_id              BIGINT NOT NULL REFERENCES permit_snapshots(id) ON DELETE CASCADE,
    source_year              INT NOT NULL,                       -- denormalised for year-scoped queries
    employer_name            TEXT NOT NULL,
    employer_name_normalised TEXT NOT NULL,                      -- lowercase/stripped for cross-year match
    permits_jan              INT,
    permits_feb              INT,
    permits_mar              INT,
    permits_apr              INT,
    permits_may              INT,
    permits_jun              INT,
    permits_jul              INT,
    permits_aug              INT,
    permits_sep              INT,
    permits_oct              INT,
    permits_nov              INT,
    permits_dec              INT,
    grand_total              INT NOT NULL DEFAULT 0,
    status                   TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE', 'UNLISTED')),
    momentum                 TEXT
        CHECK (momentum IS NULL OR momentum IN ('RISING', 'FLAT', 'DECLINING')),
    rank_overall             INT,                                -- rank within source_year
    rank_in_sector           INT                                 -- rank within matched sector
);

COMMENT ON TABLE permit_companies IS
    'Employer permit counts for a single snapshot; normalised name joins across years.';
COMMENT ON COLUMN permit_companies.employer_name_normalised IS
    'Matching key for company_reliability_scores and company_year_history.';

-- ─────────────────────────────────────────────────────────────────────────────
-- permit_sectors — sector (NACE-style) aggregates per snapshot
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE permit_sectors (
    id              BIGSERIAL PRIMARY KEY,
    snapshot_id     BIGINT NOT NULL REFERENCES permit_snapshots(id) ON DELETE CASCADE,
    source_year     INT NOT NULL,
    sector_code     TEXT NOT NULL,
    sector_name     TEXT NOT NULL,
    permits_jan     INT,
    permits_feb     INT,
    permits_mar     INT,
    permits_apr     INT,
    permits_may     INT,
    permits_jun     INT,
    permits_jul     INT,
    permits_aug     INT,
    permits_sep     INT,
    permits_oct     INT,
    permits_nov     INT,
    permits_dec     INT,
    grand_total     INT NOT NULL DEFAULT 0
);

COMMENT ON TABLE permit_sectors IS
    'Sector-level permit totals per ingestion snapshot.';

-- ─────────────────────────────────────────────────────────────────────────────
-- permit_counties — issued vs refused by county per snapshot
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE permit_counties (
    id              BIGSERIAL PRIMARY KEY,
    snapshot_id     BIGINT NOT NULL REFERENCES permit_snapshots(id) ON DELETE CASCADE,
    source_year     INT NOT NULL,
    county          TEXT NOT NULL,
    issued          INT NOT NULL DEFAULT 0,
    refused         INT NOT NULL DEFAULT 0
);

COMMENT ON TABLE permit_counties IS
    'County-level issued/refused permit counts per snapshot.';

-- ─────────────────────────────────────────────────────────────────────────────
-- company_reliability_scores — cross-year employer reliability (rebuilt on ingest)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE company_reliability_scores (
    id                       BIGSERIAL PRIMARY KEY,
    employer_name_normalised TEXT NOT NULL UNIQUE,
    canonical_name           TEXT NOT NULL,                      -- latest known display name
    first_seen_year          INT NOT NULL,
    last_seen_year           INT NOT NULL,
    years_active             INT NOT NULL,                       -- years with grand_total > 0
    total_years_in_dataset   INT NOT NULL,                       -- years present in corpus (≤ 18)
    reliability_score        NUMERIC(5, 2) NOT NULL,             -- 0.00–100.00
    reliability_tier         TEXT NOT NULL
        CHECK (reliability_tier IN (
            'ELITE', 'STRONG', 'CONSISTENT', 'OCCASIONAL', 'NEW', 'INACTIVE'
        )),
    total_permits_all_time   INT NOT NULL DEFAULT 0,
    peak_year                INT,
    peak_year_total          INT,
    avg_annual_permits       NUMERIC(8, 2),
    trend_3yr                TEXT
        CHECK (trend_3yr IS NULL OR trend_3yr IN (
            'GROWING', 'STABLE', 'DECLINING', 'INSUFFICIENT_DATA'
        )),
    yoy_change_pct           NUMERIC(6, 2),                      -- last full year vs prior
    sector_code              TEXT,                               -- from user_domain_mappings heuristic
    updated_at               TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE company_reliability_scores IS
    'Materialised cross-year employer stats; truncate/rebuild after each full ingestion.';

-- ─────────────────────────────────────────────────────────────────────────────
-- company_year_history — one row per employer per year (feeds reliability scores)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE company_year_history (
    id                       BIGSERIAL PRIMARY KEY,
    employer_name_normalised TEXT NOT NULL,
    source_year              INT NOT NULL,
    grand_total              INT NOT NULL DEFAULT 0,
    rank_that_year           INT,
    snapshot_id              BIGINT REFERENCES permit_snapshots(id),
    CONSTRAINT uq_company_year_history_employer_year
        UNIQUE (employer_name_normalised, source_year)
);

COMMENT ON TABLE company_year_history IS
    'Annual permit totals per normalised employer; source for reliability aggregation.';

-- ─────────────────────────────────────────────────────────────────────────────
-- user_domain_mappings — career domain → permit sector code (seed)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE user_domain_mappings (
    id          BIGSERIAL PRIMARY KEY,
    domain_key  TEXT NOT NULL,
    sector_code TEXT NOT NULL,
    CONSTRAINT uq_user_domain_mappings_domain_sector
        UNIQUE (domain_key, sector_code)
);

COMMENT ON TABLE user_domain_mappings IS
    'Maps user career domains to enterprise.gov.ie sector codes for ranking context.';

INSERT INTO user_domain_mappings (domain_key, sector_code) VALUES
    ('TECH',         'J'),
    ('HEALTHCARE',   'Q'),
    ('FINANCE',      'K'),
    ('CONSTRUCTION', 'F'),
    ('EDUCATION',    'P'),
    ('HOSPITALITY',  'I'),
    ('PHARMA',       'C'),
    ('AGRICULTURE',  'A');

-- ─────────────────────────────────────────────────────────────────────────────
-- user_permit_watchlist — employers a user tracks for permit activity
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE user_permit_watchlist (
    id                       BIGSERIAL PRIMARY KEY,
    user_id                  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    employer_name_normalised TEXT NOT NULL,
    added_at                 TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_user_permit_watchlist_user_employer
        UNIQUE (user_id, employer_name_normalised)
);

COMMENT ON TABLE user_permit_watchlist IS
    'Per-user saved employers for permit trend alerts and dashboard widgets.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes — snapshot/year lookups, ranking, pattern search, watchlists
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX idx_pc_snapshot ON permit_companies(snapshot_id);
CREATE INDEX idx_pc_year ON permit_companies(source_year);
CREATE INDEX idx_pc_normalised ON permit_companies(employer_name_normalised);
CREATE INDEX idx_pc_total_desc ON permit_companies(grand_total DESC);
CREATE INDEX idx_pc_name_pattern ON permit_companies(employer_name_normalised text_pattern_ops);

CREATE INDEX idx_ps_snapshot ON permit_sectors(snapshot_id);
CREATE INDEX idx_ps_year ON permit_sectors(source_year);

CREATE INDEX idx_pco_snapshot ON permit_counties(snapshot_id);

CREATE INDEX idx_cyh_normalised ON company_year_history(employer_name_normalised);
CREATE INDEX idx_cyh_year ON company_year_history(source_year);

CREATE INDEX idx_crs_normalised ON company_reliability_scores(employer_name_normalised);
CREATE INDEX idx_crs_score ON company_reliability_scores(reliability_score DESC);
CREATE INDEX idx_crs_tier ON company_reliability_scores(reliability_tier);

CREATE INDEX idx_watchlist_user ON user_permit_watchlist(user_id);
