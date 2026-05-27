-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 4 Batch 2 — Seed / demo data for Auto-Apply
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_user UUID;
  v_run  UUID;
BEGIN
  SELECT id INTO v_user FROM users ORDER BY created_at ASC LIMIT 1;
  IF v_user IS NULL THEN RETURN; END IF;

  -- ── Answer Bank ──────────────────────────────────────────────────────────────
  INSERT INTO answer_bank (id, user_id, question_key, answer_text, is_default)
  VALUES
    (gen_random_uuid(), v_user, 'work_authorization',  'Yes, I am fully authorised to work in Ireland.',        true),
    (gen_random_uuid(), v_user, 'salary_expectation',  '€80,000–€90,000 depending on the overall package.',    true),
    (gen_random_uuid(), v_user, 'notice_period',        '4 weeks',                                              true),
    (gen_random_uuid(), v_user, 'relocation',           'No relocation required — based in Dublin.',             true),
    (gen_random_uuid(), v_user, 'sponsorship_required', 'No sponsorship required.',                             true),
    (gen_random_uuid(), v_user, 'years_experience',     '5 years of professional software engineering.',        true),
    (gen_random_uuid(), v_user, 'remote_preference',    'Open to hybrid; prefer 2–3 days in-office.',           true)
  ON CONFLICT (user_id, question_key) DO NOTHING;

  -- ── Application Run (demo — completed) ────────────────────────────────────
  -- Only insert if a user_job exists for this user
  IF EXISTS (SELECT 1 FROM user_jobs WHERE user_id = v_user LIMIT 1) THEN
    v_run := gen_random_uuid();
    INSERT INTO application_runs (id, user_id, user_job_id, status, total_steps, completed_steps, submitted_at)
    SELECT v_run, v_user, id, 'completed', 5, 5, now() - INTERVAL '2' DAY
    FROM user_jobs WHERE user_id = v_user LIMIT 1;

    INSERT INTO application_run_steps (id, run_id, user_id, step_number, step_type, description, status, executed_at)
    VALUES
      (gen_random_uuid(), v_run, v_user, 1, 'prefill',          'Pre-fill contact and personal details',          'completed', now() - INTERVAL '2' DAY + INTERVAL '1' MINUTE),
      (gen_random_uuid(), v_run, v_user, 2, 'cv_upload',        'Upload selected resume version (v2 AI)',          'completed', now() - INTERVAL '2' DAY + INTERVAL '2' MINUTE),
      (gen_random_uuid(), v_run, v_user, 3, 'answer_question',  'Answer work authorisation and salary questions',  'completed', now() - INTERVAL '2' DAY + INTERVAL '3' MINUTE),
      (gen_random_uuid(), v_run, v_user, 4, 'approval_gate',    'User approval checkpoint — review before submit', 'completed', now() - INTERVAL '2' DAY + INTERVAL '4' MINUTE),
      (gen_random_uuid(), v_run, v_user, 5, 'submit',           'Submit application',                              'completed', now() - INTERVAL '2' DAY + INTERVAL '5' MINUTE);
  END IF;

END $$;
