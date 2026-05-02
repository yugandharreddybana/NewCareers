-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 4 Batch 1 — Seed / demo data
-- Inserts sample rows for the first user in the system (dev convenience).
-- All inserts are conditional (DO NOTHING on conflict) — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_user UUID;
BEGIN
  SELECT id INTO v_user FROM users ORDER BY created_at ASC LIMIT 1;
  IF v_user IS NULL THEN RETURN; END IF;

  -- ── Watchlists ──────────────────────────────────────────────────────────
  INSERT INTO job_watchlists (id, user_id, name, query_keywords, location, min_match_score, remote_only, alert_email, alert_in_app, status, matched_total, clicked_total, applied_total)
  VALUES
    (gen_random_uuid(), v_user, 'Senior Backend Engineer – Ireland', 'Java Spring Boot Postgres', 'Dublin, Ireland', 70, false, true, true, 'active', 12, 5, 2),
    (gen_random_uuid(), v_user, 'Remote AI / ML Engineer', 'Python Machine Learning LLM', null, 65, true, true, true, 'active', 8, 3, 1),
    (gen_random_uuid(), v_user, 'Product Manager – SaaS', 'Product Manager B2B SaaS', 'Dublin, Cork', 60, false, false, true, 'paused', 4, 1, 0);

  -- ── Career Memories ──────────────────────────────────────────────────────
  INSERT INTO career_memories (id, user_id, category, key, value, source, why_suggested, confidence)
  VALUES
    (gen_random_uuid(), v_user, 'role_goal',         'target_title',       'Senior Software Engineer',            'profile_update', 'Set directly in your profile goals.',                  95),
    (gen_random_uuid(), v_user, 'salary_goal',       'target_salary_eur',  '85000',                               'profile_update', 'Extracted from your salary preference field.',         95),
    (gen_random_uuid(), v_user, 'industry',          'preferred_industry', 'SaaS, FinTech',                       'skill_run',      'Inferred from your last 3 job evaluations.',           80),
    (gen_random_uuid(), v_user, 'preferred_company', 'company_type',       'Scale-up (50–500 employees)',         'skill_run',      'You applied to 4 scale-ups vs 1 enterprise.',          75),
    (gen_random_uuid(), v_user, 'writing_tone',      'cv_tone',            'Concise, achievement-first, metrics', 'accepted_edit',  'You accepted this style in 3 consecutive CV tailors.', 90),
    (gen_random_uuid(), v_user, 'outreach_tone',     'message_tone',       'Friendly, direct, no buzzwords',      'accepted_edit',  'Accepted in your last 2 outreach drafts.',             85)
  ON CONFLICT (user_id, category, key) DO NOTHING;

  -- ── Resume Versions ──────────────────────────────────────────────────────
  INSERT INTO resume_versions (id, user_id, name, version_number, source, role_tags, is_active, is_favorite, outcome_association, interview_count, application_count, offer_count, best_for_role_type, notes)
  VALUES
    (gen_random_uuid(), v_user, 'Backend Focus – v1',         1, 'manual',    ARRAY['backend'],            false, false, 'rejection', 1, 5, 0, null,                    'Original upload — lower match scores'),
    (gen_random_uuid(), v_user, 'Backend Focus – v2 (AI)',    2, 'skill_run', ARRAY['backend'],            true,  true,  'interview', 3, 8, 1, 'Senior Backend Engineer', 'AI-tailored for Stripe job — strong results'),
    (gen_random_uuid(), v_user, 'Full-stack + Leadership',    3, 'manual',    ARRAY['backend','product'],  false, false, 'unknown',   0, 2, 0, null,                    'New version for PM/tech-lead roles');

END $$;
