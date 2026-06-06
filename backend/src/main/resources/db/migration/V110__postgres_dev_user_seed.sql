-- Local Postgres dev login (same as h2-dev-seed.sql). Password: password
SET search_path TO careerops;

INSERT INTO users (id, name, username, email, password_hash, role, created_at,
                   failed_login_attempts, ai_processing_consent, locale, auth_provider)
SELECT '00000000-0000-0000-0000-000000000001', 'Dev User', 'devuser', 'dev@careerops.ie',
       '$2a$10$XURPShQNCsLjp1ESc2laoO46CE30XseQEE403jLwZk0J.b.c.4l6G', 'ADMIN', CURRENT_TIMESTAMP,
       0, TRUE, 'en', 'LOCAL'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE lower(email) = 'dev@careerops.ie');

INSERT INTO user_profiles (id, version, user_id, target_roles, tech_stack, location, salary_min, salary_max,
                           salary_currency, sectors, min_match_percent, onboarded, open_to_remote, updated_at)
SELECT '00000000-0000-0000-0000-000000000010', 0, '00000000-0000-0000-0000-000000000001',
       ARRAY['Senior Frontend Engineer', 'Full Stack Developer'],
       ARRAY['React', 'TypeScript', 'Tailwind CSS', 'Redux'],
       'Dublin (Hybrid)', 75000, 95000, 'EUR',
       ARRAY['Fintech', 'SaaS'], 70, TRUE, TRUE, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = '00000000-0000-0000-0000-000000000001');
