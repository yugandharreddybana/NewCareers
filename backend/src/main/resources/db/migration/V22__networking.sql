-- ============================================================
-- V22 — Section 3.3: Networking / Contact Pipeline
-- ============================================================

CREATE TABLE IF NOT EXISTS network_contacts (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                     VARCHAR(255) NOT NULL,
    email                    VARCHAR(255),
    linkedin_url             TEXT,
    company                  VARCHAR(255),
    role_title               VARCHAR(255),
    contact_type             VARCHAR(50)  NOT NULL DEFAULT 'recruiter'
                                 CHECK (contact_type IN ('recruiter','hiring_manager','alumni','referral')),
    relationship_temperature VARCHAR(20)  NOT NULL DEFAULT 'cold'
                                 CHECK (relationship_temperature IN ('cold','warm','hot')),
    pipeline_stage           VARCHAR(50)  NOT NULL DEFAULT 'identified'
                                 CHECK (pipeline_stage IN ('identified','connected','outreached','replied','meeting_scheduled','closed')),
    notes                    TEXT,
    linked_user_job_id       UUID REFERENCES user_jobs(id) ON DELETE SET NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_network_contacts_user_id
    ON network_contacts(user_id);

CREATE INDEX IF NOT EXISTS idx_network_contacts_pipeline_stage
    ON network_contacts(user_id, pipeline_stage);

-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contact_interactions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id         UUID NOT NULL REFERENCES network_contacts(id) ON DELETE CASCADE,
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interaction_type   VARCHAR(50) NOT NULL
                           CHECK (interaction_type IN ('linkedin_message','email','call','meeting','follow_up')),
    outcome            VARCHAR(30)
                           CHECK (outcome IN ('no_response','positive','negative','meeting_booked')),
    notes              TEXT,
    next_step          TEXT,
    next_step_due_date DATE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_interactions_contact_id
    ON contact_interactions(contact_id);

CREATE INDEX IF NOT EXISTS idx_contact_interactions_overdue
    ON contact_interactions(user_id, next_step_due_date)
    WHERE next_step_due_date IS NOT NULL;
