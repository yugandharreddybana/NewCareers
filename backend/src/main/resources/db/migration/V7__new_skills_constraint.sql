-- V7: Update skill_runs check constraint to allow 14 skill name values
-- Phase 2 adds: salary-negotiation, culture-fit, linkedin-optimize, cover-letter, skills-gap-plan

ALTER TABLE skill_runs DROP CONSTRAINT IF EXISTS skill_runs_skill_check;

ALTER TABLE skill_runs
    ADD CONSTRAINT skill_runs_skill_check CHECK (
        skill IN (
            'evaluate', 'tailor-resume', 'apply', 'outreach',
            'research', 'prep-interview', 'compare', 'triage', 'scan',
            'salary-negotiation', 'culture-fit', 'linkedin-optimize',
            'cover-letter', 'skills-gap-plan'
        )
    );
