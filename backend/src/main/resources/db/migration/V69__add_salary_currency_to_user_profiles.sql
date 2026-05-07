SET search_path TO career_operations;

-- V69 — Add salary_currency column to user_profiles.
-- Enhances multi-currency support for user preference alignments across different global markets.

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS salary_currency TEXT DEFAULT 'EUR';
