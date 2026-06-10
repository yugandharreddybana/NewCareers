SET search_path TO careerops;

ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;

-- Paid subs: anchor period start 30 days before known period end
UPDATE subscriptions
SET current_period_start = current_period_end - INTERVAL '30 days'
WHERE current_period_start IS NULL
  AND current_period_end IS NOT NULL;

-- FREE / never-paid: anchor on subscription creation
UPDATE subscriptions
SET current_period_start = created_at
WHERE current_period_start IS NULL;
