-- Widen PII columns that store AES-GCM ciphertext (Base64, longer than plaintext VARCHAR limits).

ALTER TABLE careerops.users ALTER COLUMN name TYPE TEXT;

ALTER TABLE careerops.user_profiles ALTER COLUMN goal_title TYPE TEXT;
ALTER TABLE careerops.user_profiles ALTER COLUMN goal_location TYPE TEXT;
