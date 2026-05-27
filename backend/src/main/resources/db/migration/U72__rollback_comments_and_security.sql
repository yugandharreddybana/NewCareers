SET search_path TO careerops;

COMMENT ON TABLE users IS NULL;
COMMENT ON TABLE jobs IS NULL;
COMMENT ON TABLE user_jobs IS NULL;
COMMENT ON TABLE cv_documents IS NULL;
COMMENT ON TABLE password_resets IS NULL;
COMMENT ON TABLE experiments IS NULL;
COMMENT ON TABLE experiment_assignments IS NULL;
COMMENT ON TABLE onboarding_events IS NULL;
COMMENT ON TABLE network_contacts IS NULL;
COMMENT ON TABLE contact_interactions IS NULL;

COMMENT ON COLUMN cv_documents.parsed_text IS NULL;
COMMENT ON COLUMN password_resets.otp_hash IS NULL;

