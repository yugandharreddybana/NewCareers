-- BILL-033: Unique Stripe customer per org subscription.
-- BILL-036: Flag legacy paid rows without Stripe linkage for reconciliation.
SET search_path TO careerops;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_unique
    ON subscriptions (stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL AND stripe_customer_id <> '';

-- Legacy backfill: paid ACTIVE rows with no Stripe IDs need billing setup (PAST_DUE).
UPDATE subscriptions
SET status = 'PAST_DUE'
WHERE plan IN ('PRO', 'ENTERPRISE')
  AND status = 'ACTIVE'
  AND (stripe_subscription_id IS NULL OR btrim(stripe_subscription_id) = '')
  AND (stripe_customer_id IS NULL OR btrim(stripe_customer_id) = '');
