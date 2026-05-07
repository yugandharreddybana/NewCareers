SET search_path TO career_operations;

-- V65 — Stripe Billing Schema Implementation.
-- Establishes Stripe customers, subscriptions, and invoices tracking tables to support end-to-end billing.

-- 1. Stripe Customers Table
CREATE TABLE IF NOT EXISTS stripe_customers (
    user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    customer_id TEXT UNIQUE NOT NULL, -- Stripe Customer ID (cus_...)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_customers_id ON stripe_customers(customer_id);

-- 2. Stripe Subscriptions Table
CREATE TABLE IF NOT EXISTS stripe_subscriptions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    subscription_id       TEXT UNIQUE NOT NULL, -- Stripe Subscription ID (sub_...)
    status                TEXT NOT NULL,        -- active, trialing, incomplete, past_due, canceled
    price_id              TEXT NOT NULL,        -- price_...
    current_period_start  TIMESTAMPTZ NOT NULL,
    current_period_end    TIMESTAMPTZ NOT NULL,
    cancel_at_period_end  BOOLEAN NOT NULL DEFAULT false,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_subs_user ON stripe_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subs_status ON stripe_subscriptions(status);

-- 3. Stripe Invoices Table
CREATE TABLE IF NOT EXISTS stripe_invoices (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    invoice_id         TEXT UNIQUE NOT NULL, -- Stripe Invoice ID (in_...)
    amount_paid        INTEGER NOT NULL,     -- Amount in cents
    currency           VARCHAR(10) NOT NULL DEFAULT 'EUR',
    status             TEXT NOT NULL,        -- paid, open, uncollectible, void
    hosted_invoice_url TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_invoices_user ON stripe_invoices(user_id);
