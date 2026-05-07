SET search_path TO career_operations;

-- 10.061 — Security Hardening: Enable pgcrypto for sym_encrypt support
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 10.060 — Schema Documentation: Add table-level and column-level comments
COMMENT ON TABLE users IS 'User accounts table containing credentials and basic metadata';
COMMENT ON TABLE jobs IS 'Scraped/imported job descriptions and matching metadata';
COMMENT ON TABLE user_jobs IS 'Per-user delivered job recommendations with match score and kanban state';
COMMENT ON TABLE cv_documents IS 'User uploaded CV and resume documents with parsed texts';
COMMENT ON TABLE password_resets IS 'Password reset sessions and OTP attempt tracking';
COMMENT ON TABLE experiments IS 'AB test configuration and status';
COMMENT ON TABLE experiment_assignments IS 'Assigned AB test variant per user';
COMMENT ON TABLE onboarding_events IS 'User onboarding progress and conversion analytics events';
COMMENT ON TABLE network_contacts IS 'CRM networking contacts managed by users';
COMMENT ON TABLE contact_interactions IS 'CRM logged interactions and follow-up activities with contacts';

COMMENT ON COLUMN cv_documents.parsed_text IS 'Parsed text content of the CV document (should be encrypted-at-rest using pgp_sym_encrypt)';
COMMENT ON COLUMN password_resets.otp_hash IS 'Secure cryptographically hashed OTP value (using SHA-256 or bcrypt)';
