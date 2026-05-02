-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 4 Batch 2 — Outreach seed data
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_user   UUID;
  v_camp1  UUID := gen_random_uuid();
  v_camp2  UUID := gen_random_uuid();
  v_seq1   UUID := gen_random_uuid();
  v_seq2   UUID := gen_random_uuid();
BEGIN
  SELECT id INTO v_user FROM users ORDER BY created_at ASC LIMIT 1;
  IF v_user IS NULL THEN RETURN; END IF;

  -- ── Campaigns ────────────────────────────────────────────────────────────
  INSERT INTO outreach_campaigns
    (id, user_id, name, campaign_type, status, target_count, sent_count, replied_count, positive_count)
  VALUES
    (v_camp1, v_user, 'Stripe Recruiter Outreach', 'recruiter_outreach', 'active',   10, 6, 2, 1),
    (v_camp2, v_user, 'Alumni Follow-up – Dublin', 'alumni_outreach',    'draft',     5, 0, 0, 0);

  -- ── Sequences ────────────────────────────────────────────────────────────
  INSERT INTO outreach_sequences
    (id, campaign_id, user_id, step_number, delay_days, body_template, channel)
  VALUES
    (v_seq1, v_camp1, v_user, 1, 0,
     'Hi {{name}}, I came across your profile while researching the engineering team at {{company}}. I am a backend engineer with 5 years of Java and Postgres experience. I would love to connect and learn more about open roles.',
     'linkedin'),
    (v_seq2, v_camp1, v_user, 2, 5,
     'Hi {{name}}, following up on my previous message. I am still very interested in {{company}} and wanted to stay on your radar. Happy to share my CV if helpful.',
     'linkedin');

  -- ── Messages ─────────────────────────────────────────────────────────────
  INSERT INTO outreach_messages
    (campaign_id, sequence_id, user_id, contact_name, contact_linkedin, personalised_body, status, sent_at, replied_at, score)
  VALUES
    (v_camp1, v_seq1, v_user, 'Sarah O''Brien',   'https://linkedin.com/in/sarahobrien',  'Hi Sarah, I came across your profile while researching the engineering team at Stripe…', 'replied',   now() - interval '5 days', now() - interval '2 days', 85),
    (v_camp1, v_seq1, v_user, 'James Murphy',     'https://linkedin.com/in/jamesmurphy',  'Hi James, I came across your profile while researching the engineering team at Stripe…', 'sent',      now() - interval '3 days', null, 78),
    (v_camp1, v_seq1, v_user, 'Aoife Kelly',      'https://linkedin.com/in/aoifekelly',   'Hi Aoife, I came across your profile while researching the engineering team at Stripe…', 'opened',    now() - interval '4 days', null, 72);

END $$;
