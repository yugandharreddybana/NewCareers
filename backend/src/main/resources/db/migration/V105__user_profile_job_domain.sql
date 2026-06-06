-- Career domain for Irish employment permit analytics personalisation
ALTER TABLE careerops.user_profiles
    ADD COLUMN IF NOT EXISTS job_domain VARCHAR(32);

COMMENT ON COLUMN careerops.user_profiles.job_domain IS
    'User-selected career domain key (TECH, HEALTHCARE, …) for permit analytics.';
