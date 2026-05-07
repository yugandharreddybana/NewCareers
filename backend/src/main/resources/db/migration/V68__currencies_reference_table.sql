SET search_path TO career_operations;

-- V68 — Currencies Reference Schema Table.
-- Enables per-market currencies to support SaaS expansion to non-EU markets.

CREATE TABLE IF NOT EXISTS currencies (
    code   VARCHAR(10) PRIMARY KEY,
    name   VARCHAR(100) NOT NULL,
    symbol VARCHAR(10) NOT NULL
);

INSERT INTO currencies (code, name, symbol) VALUES
('EUR', 'Euro', '€'),
('USD', 'US Dollar', '$'),
('GBP', 'British Pound', '£')
ON CONFLICT (code) DO NOTHING;
