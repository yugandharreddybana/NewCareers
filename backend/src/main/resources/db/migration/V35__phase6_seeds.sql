-- Phase 6 seed data for demo/dev
SET search_path TO careerops;

DO $$
DECLARE
  v_user_id UUID;
  v_org_id  UUID;
  v_team_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM users LIMIT 1;
  IF v_user_id IS NULL THEN RETURN; END IF;

  -- Demo organization
  INSERT INTO organizations (id, name, slug, plan, domain, seat_limit, settings)
  VALUES (
    gen_random_uuid(), 'Acme Corp', 'acme-corp', 'growth',
    'acme.com', 25,
    '{"allowedDomains":["acme.com"],"requireSso":false,"dataRetentionDays":365}'
  )
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO v_org_id;

  IF v_org_id IS NOT NULL THEN
    -- Add the first user as owner
    INSERT INTO org_members (org_id, user_id, role)
    VALUES (v_org_id, v_user_id, 'owner')
    ON CONFLICT (org_id, user_id) DO NOTHING;

    -- Demo team
    INSERT INTO org_teams (id, org_id, name, description, created_by)
    VALUES (gen_random_uuid(), v_org_id, 'Engineering', 'Backend & platform engineers', v_user_id)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_team_id;

    -- Pending invitation
    INSERT INTO org_invitations (org_id, invited_by, email, role, token)
    VALUES (v_org_id, v_user_id, 'colleague@acme.com', 'member', encode(gen_random_bytes(32), 'hex'))
    ON CONFLICT DO NOTHING;

    -- Demo SSO provider (disabled)
    INSERT INTO sso_providers (org_id, provider_type, enabled, config)
    VALUES (v_org_id, 'saml', false, '{"entityId":"","acsUrl":"","metadataUrl":""}')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Demo audit log entries
  INSERT INTO audit_log (user_id, action, resource_type, ip_address, severity)
  SELECT v_user_id, action, resource_type, '127.0.0.1', 'info'
  FROM (VALUES
    ('user.login',         'session'),
    ('job.view',           'user_job'),
    ('skill.run',          'skill_run'),
    ('resume.upload',      'cv_document'),
    ('watchlist.create',   'job_watchlist')
  ) AS t(action, resource_type);

  -- Demo token usage
  INSERT INTO ai_token_usage (user_id, feature, model, input_tokens, output_tokens, total_tokens, cost_usd)
  SELECT v_user_id, feature, model, input_t, output_t, input_t + output_t, cost
  FROM (VALUES
    ('tailor-resume',    'claude-3-5-haiku-20241022', 1200, 800, 0.000300),
    ('cover-letter',     'claude-3-5-haiku-20241022', 950,  600, 0.000232),
    ('prep-interview',   'claude-3-5-sonnet-20241022',2400, 1800, 0.001260),
    ('evaluate',         'claude-3-5-haiku-20241022', 450,  300, 0.000112),
    ('skills-gap-plan',  'claude-3-5-sonnet-20241022',1800, 2200, 0.001500),
    ('salary-negotiation','claude-3-5-haiku-20241022',600,  700, 0.000195)
  ) AS t(feature, model, input_t, output_t, cost);

  -- Demo recommendation feedback
  INSERT INTO recommendation_feedback (user_id, feedback_type)
  VALUES
    (v_user_id, 'useful'),
    (v_user_id, 'not_useful'),
    (v_user_id, 'useful');

END $$;

