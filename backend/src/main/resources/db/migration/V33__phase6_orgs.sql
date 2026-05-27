-- Phase 6.1 — Organization & Team Management
SET search_path TO careerops;

-- ── Organizations ──────────────────────────────────────────────────────────
CREATE TABLE organizations (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    plan            VARCHAR(50)  NOT NULL DEFAULT 'starter',  -- starter|growth|enterprise
    logo_url        VARCHAR(500),
    domain          VARCHAR(255),                             -- verified domain for auto-join
    seat_limit      INT          NOT NULL DEFAULT 5,
    settings        JSONB        NOT NULL DEFAULT '{}',
    created_at      TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW()
);

-- ── Organization Members ───────────────────────────────────────────────────
CREATE TABLE org_members (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id          UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(50)  NOT NULL DEFAULT 'member',   -- owner|admin|member|viewer
    status          VARCHAR(30)  NOT NULL DEFAULT 'active',   -- active|suspended
    joined_at       TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, user_id)
);

-- ── Organization Invitations ───────────────────────────────────────────────
CREATE TABLE org_invitations (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id          UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invited_by      UUID         NOT NULL REFERENCES users(id),
    email           VARCHAR(255) NOT NULL,
    role            VARCHAR(50)  NOT NULL DEFAULT 'member',
    token           VARCHAR(128) NOT NULL UNIQUE,
    status          VARCHAR(30)  NOT NULL DEFAULT 'pending',  -- pending|accepted|expired|revoked
    expires_at      TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW() + INTERVAL '7' DAY,
    created_at      TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW()
);

-- ── Organization Teams ─────────────────────────────────────────────────────
CREATE TABLE org_teams (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id          UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    created_by      UUID         NOT NULL REFERENCES users(id),
    created_at      TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, name)
);

-- ── Team Members ───────────────────────────────────────────────────────────
CREATE TABLE org_team_members (
    team_id         UUID         NOT NULL REFERENCES org_teams(id) ON DELETE CASCADE,
    user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_at        TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (team_id, user_id)
);

-- ── IP Allowlists (6.5) ────────────────────────────────────────────────────
CREATE TABLE org_ip_allowlists (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id          UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    cidr            VARCHAR(50)  NOT NULL,
    label           VARCHAR(100),
    created_by      UUID         NOT NULL REFERENCES users(id),
    created_at      TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW()
);

-- ── SSO Providers (6.5) ────────────────────────────────────────────────────
CREATE TABLE sso_providers (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id          UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider_type   VARCHAR(50)  NOT NULL DEFAULT 'saml',    -- saml|oidc
    metadata_url    VARCHAR(500),
    client_id       VARCHAR(255),
    client_secret   VARCHAR(500),
    enabled         BOOLEAN      NOT NULL DEFAULT false,
    config          JSONB        NOT NULL DEFAULT '{}',
    created_at      TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW()
);

-- ── SCIM Tokens (6.5) ──────────────────────────────────────────────────────
CREATE TABLE scim_tokens (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id          UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    token_hash      VARCHAR(128) NOT NULL UNIQUE,
    label           VARCHAR(100),
    last_used_at    TIMESTAMP WITH TIME ZONE,
    created_by      UUID         NOT NULL REFERENCES users(id),
    created_at      TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_org_members_org   ON org_members(org_id);
CREATE INDEX idx_org_members_user  ON org_members(user_id);
CREATE INDEX idx_org_invitations_email ON org_invitations(email);
CREATE INDEX idx_org_invitations_token ON org_invitations(token);
CREATE INDEX idx_org_teams_org     ON org_teams(org_id);

