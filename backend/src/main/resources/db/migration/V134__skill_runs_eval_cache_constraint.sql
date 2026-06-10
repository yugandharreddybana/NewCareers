-- Allow AI eval cache rows (LIGHT_SCORE / DEEP_EVAL) and catalog skills track + help.

ALTER TABLE skill_runs DROP CONSTRAINT IF EXISTS skill_runs_skill_check;

ALTER TABLE skill_runs
    ADD CONSTRAINT skill_runs_skill_check CHECK (
        skill IN (
            'evaluate', 'tailor-resume', 'apply', 'outreach',
            'research', 'prep-interview', 'compare', 'triage', 'scan',
            'salary-negotiation', 'culture-fit', 'linkedin-optimize',
            'cover-letter', 'skills-gap-plan',
            'track', 'help',
            'LIGHT_SCORE', 'DEEP_EVAL'
        )
    );
