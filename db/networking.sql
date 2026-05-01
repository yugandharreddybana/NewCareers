-- CareerOps :: Section 3.3 - Referral Networking Toolkit
-- Run after schema.sql in the Supabase SQL editor.
-- Adds: network_contacts, contact_interactions

-- ─────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE career_operations.contact_type AS ENUM (
    'recruiter',
    'hiring_manager',
    'alumni',
    'referral'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE career_operations.relationship_temperature AS ENUM (
    'cold',
    'warm',
    'hot'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE career_operations.contact_pipeline_stage AS ENUM (
    'identified',
    'connected',
    'outreached',
    'replied',
    'meeting_scheduled',
    'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE career_operations.interaction_type AS ENUM (
    'linkedin_message',
    'email',
    'call',
    'meeting',
    'follow_up'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE career_operations.interaction_outcome AS ENUM (
    'no_response',
    'positive',
    'negative',
    'meeting_booked'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- TABLE: network_contacts  (Task 33)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS career_operations.network_contacts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES career_operations.users(id) ON DELETE CASCADE,
    name                    TEXT NOT NULL,
    email                   TEXT,
    linkedin_url            TEXT,
    company                 TEXT,
    role_title              TEXT,
    contact_type            career_operations.contact_type NOT NULL DEFAULT 'recruiter',
    relationship_temperature career_operations.relationship_temperature NOT NULL DEFAULT 'cold',
    pipeline_stage          career_operations.contact_pipeline_stage NOT NULL DEFAULT 'identified',
    notes                   TEXT,
    -- links to a job the user found via this contact (optional)
    linked_user_job_id      UUID REFERENCES career_operations.user_jobs(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_network_contacts_user
    ON career_operations.network_contacts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_network_contacts_type
    ON career_operations.network_contacts(user_id, contact_type);

CREATE INDEX IF NOT EXISTS idx_network_contacts_pipeline
    ON career_operations.network_contacts(user_id, pipeline_stage);

-- ─────────────────────────────────────────────
-- TABLE: contact_interactions  (Task 34)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS career_operations.contact_interactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id          UUID NOT NULL REFERENCES career_operations.network_contacts(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES career_operations.users(id) ON DELETE CASCADE,
    interaction_type    career_operations.interaction_type NOT NULL,
    outcome             career_operations.interaction_outcome,
    notes               TEXT,
    next_step           TEXT,
    next_step_due_date  DATE,
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_interactions_contact
    ON career_operations.contact_interactions(contact_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_interactions_user
    ON career_operations.contact_interactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_interactions_due
    ON career_operations.contact_interactions(user_id, next_step_due_date)
    WHERE next_step_due_date IS NOT NULL;

-- ─────────────────────────────────────────────
-- updated_at auto-refresh trigger
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION career_operations.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_network_contacts_updated_at ON career_operations.network_contacts;
CREATE TRIGGER trg_network_contacts_updated_at
  BEFORE UPDATE ON career_operations.network_contacts
  FOR EACH ROW EXECUTE FUNCTION career_operations.set_updated_at();

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────

ALTER TABLE career_operations.network_contacts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_operations.contact_interactions ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own contacts
CREATE POLICY IF NOT EXISTS "network_contacts_owner"
    ON career_operations.network_contacts
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Users can only see and manage their own interactions
CREATE POLICY IF NOT EXISTS "contact_interactions_owner"
    ON career_operations.contact_interactions
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
