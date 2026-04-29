-- CareerOps :: career_operations schema
-- Run in the Supabase SQL editor before starting the backend.

CREATE SCHEMA IF NOT EXISTS career_operations;

-- Users
CREATE TABLE IF NOT EXISTS career_operations.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- User Profile
CREATE TABLE IF NOT EXISTS career_operations.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES career_operations.users(id) ON DELETE CASCADE,
    target_roles TEXT[],
    tech_stack TEXT[],
    location TEXT DEFAULT 'Ireland',
    salary_min INTEGER,
    salary_max INTEGER,
    sectors TEXT[],
    freshness_hours INTEGER DEFAULT 96,
    min_match_percent INTEGER DEFAULT 60,
    sponsorship_required BOOLEAN DEFAULT false,
    onboarded BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- CV storage references
CREATE TABLE IF NOT EXISTS career_operations.user_cvs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES career_operations.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_type TEXT,
    parsed_text TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    is_active BOOLEAN DEFAULT true
);

-- Jobs pool (globally deduped)
CREATE TABLE IF NOT EXISTS career_operations.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT,
    salary_min INTEGER,
    salary_max INTEGER,
    currency TEXT DEFAULT 'EUR',
    sponsorship BOOLEAN,
    description TEXT,
    source_url TEXT,
    source_name TEXT,
    sector TEXT,
    posted_at TIMESTAMPTZ,
    scraped_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON career_operations.jobs(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON career_operations.jobs(company);

-- Per-user scoring + delivery
CREATE TABLE IF NOT EXISTS career_operations.user_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES career_operations.users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES career_operations.jobs(id) ON DELETE CASCADE,
    ai_score INTEGER,
    match_percent INTEGER,
    pre_match_score INTEGER DEFAULT 0,   -- fast keyword pre-score (JobMatchingService)
    matched_skills TEXT[],
    unmatched_skills TEXT[],
    cv_improvement_tips TEXT[],
    score_breakdown JSONB,
    human_summary TEXT,
    verdict TEXT,
    delivered_at TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'new',
    kanban_column TEXT DEFAULT 'Discovered',
    UNIQUE(user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_user_jobs_user ON career_operations.user_jobs(user_id, delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_jobs_kanban ON career_operations.user_jobs(user_id, kanban_column);

-- Per-user dedup guard
CREATE TABLE IF NOT EXISTS career_operations.seen_jobs (
    user_id UUID REFERENCES career_operations.users(id) ON DELETE CASCADE,
    fingerprint TEXT NOT NULL,
    seen_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, fingerprint)
);

-- Per-application CV tracking
CREATE TABLE IF NOT EXISTS career_operations.application_cvs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_job_id UUID REFERENCES career_operations.user_jobs(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Daily fetch counter
CREATE TABLE IF NOT EXISTS career_operations.daily_fetch_log (
    user_id UUID REFERENCES career_operations.users(id) ON DELETE CASCADE,
    fetch_date DATE DEFAULT CURRENT_DATE,
    count INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, fetch_date)
);

-- Skill invocation history (cache + audit)
CREATE TABLE IF NOT EXISTS career_operations.skill_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES career_operations.users(id) ON DELETE CASCADE,
    user_job_id UUID REFERENCES career_operations.user_jobs(id) ON DELETE SET NULL,
    skill TEXT NOT NULL,
    input JSONB,
    output JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_runs_lookup
  ON career_operations.skill_runs(user_id, user_job_id, skill, created_at DESC);

-- Password reset OTPs
CREATE TABLE IF NOT EXISTS career_operations.password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Irish tech companies registry
-- Mirrors JsoupCompanySource; can be managed via admin UI in future.
CREATE TABLE IF NOT EXISTS career_operations.irish_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    careers_url TEXT NOT NULL,
    category TEXT,
    active BOOLEAN DEFAULT true,
    added_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_irish_companies_active
    ON career_operations.irish_companies(active);

-- Seed key companies
INSERT INTO career_operations.irish_companies (name, careers_url, category) VALUES
  ('Google',       'https://careers.google.com/jobs/results/?location=Dublin', 'Big Tech'),
  ('Meta',         'https://www.metacareers.com/jobs?offices[0]=Dublin', 'Big Tech'),
  ('Microsoft',    'https://jobs.microsoft.com/en-us/search?location=Dublin', 'Big Tech'),
  ('Stripe',       'https://stripe.com/jobs/search?office=dublin', 'Fintech'),
  ('HubSpot',      'https://www.hubspot.com/careers/jobs', 'SaaS'),
  ('Intercom',     'https://boards.greenhouse.io/intercom', 'Irish Scale-up'),
  ('Fenergo',      'https://fenergo.com/careers/', 'Fintech'),
  ('Wayflyer',     'https://www.wayflyer.com/careers', 'Fintech'),
  ('NearForm',     'https://nearform.com/careers/', 'Consultancy'),
  ('Version 1',    'https://www.version1.com/careers/current-vacancies/', 'Consultancy'),
  ('Teamwork',     'https://www.teamwork.com/careers/', 'Irish Scale-up'),
  ('AMCS Group',   'https://amcsgroup.com/careers/', 'Irish Scale-up'),
  ('Flipdish',     'https://www.flipdish.com/careers/', 'Irish Scale-up'),
  ('Ekco',         'https://www.ekco.io/careers/', 'Managed Services'),
  ('Revolut',      'https://www.revolut.com/en-IE/careers/', 'Fintech'),
  ('CrowdStrike',  'https://crowdstrike.wd5.myworkdayjobs.com/crowdstrikecareers/jobs?Location_Country=IRL', 'Cybersecurity'),
  ('PayPal',       'https://careers.pypl.com/home/', 'IDA-Backed'),
  ('Mastercard',   'https://careers.mastercard.com/us/en/search-results?keywords=&location=Dublin', 'IDA-Backed'),
  ('Accenture',    'https://www.accenture.com/ie-en/careers/jobsearch', 'Consultancy'),
  ('Deloitte',     'https://apply.deloitte.com/careers/SearchJobs/', 'Consultancy'),
  ('IBM',          'https://www.ibm.com/employment/search-jobs/?country=Ireland', 'IDA-Backed'),
  ('SAP',          'https://jobs.sap.com/search/?q=&location=Dublin', 'IDA-Backed'),
  ('Salesforce',   'https://salesforce.wd12.myworkdayjobs.com/Salesforce/jobs?Location_Country=IRL', 'Big Tech'),
  ('Cloudflare',   'https://www.cloudflare.com/careers/jobs/?location=Dublin', 'SaaS'),
  ('MongoDB',      'https://www.mongodb.com/company/careers/departments', 'SaaS'),
  ('Coinbase',     'https://www.coinbase.com/careers/positions', 'Fintech'),
  ('AIB',          'https://aib.ie/careers', 'Financial Services'),
  ('Bank of Ireland', 'https://careers.bankofireland.com/en/jobs/', 'Financial Services'),
  ('Vodafone Ireland', 'https://careers.vodafone.ie/search/', 'Telecoms'),
  ('Eir',          'https://eir.ie/careers/', 'Telecoms')
ON CONFLICT (name) DO NOTHING;

-- RLS
ALTER TABLE career_operations.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_operations.user_jobs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_operations.user_cvs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_operations.seen_jobs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_operations.daily_fetch_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_operations.application_cvs ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_operations.skill_runs    ENABLE ROW LEVEL SECURITY;

-- Storage buckets (run in Supabase Storage UI or via API):
--   - user-cvs        (private)
--   - application-cvs (private)
