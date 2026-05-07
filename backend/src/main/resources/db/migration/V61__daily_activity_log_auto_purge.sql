SET search_path TO career_operations;

-- V61 — Configure auto-purge mechanism on daily_activity_log via DB trigger.
-- Ensures self-cleaning database operations that bound the table size without relying on external cron jobs.

CREATE OR REPLACE FUNCTION prune_old_activity_logs()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM daily_activity_log WHERE activity_date < CURRENT_DATE - INTERVAL '1 year';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prune_old_activity_logs ON daily_activity_log;

CREATE TRIGGER trg_prune_old_activity_logs
AFTER INSERT ON daily_activity_log
FOR EACH STATEMENT
EXECUTE FUNCTION prune_old_activity_logs();
