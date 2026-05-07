-- V70 — Enable pg_stat_statements for query performance auditing.
-- Provides production SQL telemetry to analyze query execution times and slow queries.

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
