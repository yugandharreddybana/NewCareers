-- AI skills enabled by default; no separate opt-in in the product UI.
ALTER TABLE users ALTER COLUMN ai_processing_consent SET DEFAULT TRUE;
UPDATE users SET ai_processing_consent = TRUE WHERE ai_processing_consent = FALSE;
