SET search_path TO careerops;

-- V56 — Database numeric precisions.

-- 1. Increase cost_usd precision to prevent aggregations overflowing the 9999.999999 limit
ALTER TABLE ai_token_usage ALTER COLUMN cost_usd TYPE NUMERIC(15,6);

