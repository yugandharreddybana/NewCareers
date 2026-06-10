-- Backfill legacy trial rows to active free subscriptions.
UPDATE careerops.subscriptions
SET status = 'ACTIVE',
    plan = 'FREE',
    trial_ends_at = NULL
WHERE status = 'TRIALING';

ALTER TABLE careerops.subscriptions
    ALTER COLUMN status SET DEFAULT 'ACTIVE';
