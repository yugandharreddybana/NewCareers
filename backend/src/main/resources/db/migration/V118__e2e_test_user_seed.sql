-- E2E Playwright shared profile. Password: Test@1234
SET search_path TO careerops;

INSERT INTO users (id, name, username, email, password_hash, role, created_at,
                   failed_login_attempts, ai_processing_consent, locale, auth_provider)
SELECT '00000000-0000-0000-0000-000000000002', 'E2E Test User', 'test', 'test@newcareer.com',
       '$2b$10$IHxaaMWKd/byJ8IJRd4XM.Pw9RjfP7GbOkHyXqQyDbTkyIFhTn68i', 'USER', CURRENT_TIMESTAMP,
       0, TRUE, 'en', 'LOCAL'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE lower(email) = 'test@newcareer.com');

INSERT INTO user_profiles (id, version, user_id, target_roles, tech_stack, location, salary_min, salary_max,
                           salary_currency, sectors, min_match_percent, onboarded, open_to_remote, updated_at)
SELECT '00000000-0000-0000-0000-000000000020', 0, '00000000-0000-0000-0000-000000000002',
       ARRAY['Software Engineer'],
       ARRAY['TypeScript', 'React'],
       'Remote', 50000, 90000, 'EUR',
       ARRAY['SaaS'], 60, TRUE, TRUE, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = '00000000-0000-0000-0000-000000000002');
