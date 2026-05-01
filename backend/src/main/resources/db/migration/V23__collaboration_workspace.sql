-- ============================================================
-- Section 3.4: Collaboration and Mentor Review
-- Tasks 45, 46, 47
-- ============================================================

-- Task 45: shared_workspaces table
CREATE TABLE IF NOT EXISTS shared_workspaces (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shared_workspaces_owner ON shared_workspaces(owner_id);

-- Task 46: workspace_members table with roles: owner, mentor, reviewer
CREATE TABLE IF NOT EXISTS workspace_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES shared_workspaces(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    invited_email   VARCHAR(255),
    role            VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'mentor', 'reviewer')),
    invite_status   VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (invite_status IN ('pending', 'accepted', 'declined')),
    invite_token    VARCHAR(255) UNIQUE,
    invite_token_expires_at TIMESTAMPTZ,
    joined_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT wm_user_or_email CHECK (user_id IS NOT NULL OR invited_email IS NOT NULL)
);

CREATE INDEX idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX idx_workspace_members_token ON workspace_members(invite_token) WHERE invite_token IS NOT NULL;

-- Task 47: shared_notes table for collaborative comments on jobs and application assets
CREATE TABLE IF NOT EXISTS shared_notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES shared_workspaces(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type     VARCHAR(100) CHECK (target_type IN ('cover_letter', 'cv_section', 'job', 'general')),
    target_id       UUID,
    content         TEXT NOT NULL,
    parent_note_id  UUID REFERENCES shared_notes(id) ON DELETE CASCADE,
    resolved        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shared_notes_workspace ON shared_notes(workspace_id);
CREATE INDEX idx_shared_notes_author ON shared_notes(author_id);
CREATE INDEX idx_shared_notes_target ON shared_notes(target_type, target_id);
CREATE INDEX idx_shared_notes_parent ON shared_notes(parent_note_id) WHERE parent_note_id IS NOT NULL;
