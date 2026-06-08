SET search_path TO careerops;

CREATE TABLE subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    plan                    VARCHAR(20) NOT NULL DEFAULT 'FREE',
    status                  VARCHAR(20) NOT NULL DEFAULT 'TRIALING',
    stripe_customer_id      VARCHAR(255),
    stripe_subscription_id  VARCHAR(255),
    current_period_end      TIMESTAMPTZ,
    trial_ends_at           TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_subscriptions_plan CHECK (plan IN ('FREE', 'PRO', 'ENTERPRISE')),
    CONSTRAINT chk_subscriptions_status CHECK (status IN ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELLED'))
);

CREATE INDEX idx_subscriptions_org ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id)
    WHERE stripe_subscription_id IS NOT NULL;

INSERT INTO subscriptions (organization_id, plan, status, trial_ends_at)
SELECT o.id,
       CASE o.plan
           WHEN 'enterprise' THEN 'ENTERPRISE'
           WHEN 'growth'     THEN 'PRO'
           ELSE 'FREE'
       END,
       'ACTIVE',
       NULL
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.organization_id = o.id);
