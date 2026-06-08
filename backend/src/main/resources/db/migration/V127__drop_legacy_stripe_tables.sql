-- BILL-023: Remove orphaned V65 user-scoped Stripe tables (superseded by V124 subscriptions).
SET search_path TO careerops;

DROP TABLE IF EXISTS stripe_invoices;
DROP TABLE IF EXISTS stripe_subscriptions;
DROP TABLE IF EXISTS stripe_customers;
