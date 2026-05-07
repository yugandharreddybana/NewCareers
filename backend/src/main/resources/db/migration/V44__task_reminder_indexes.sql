-- 5.006 — Optimize overdue task scanning
-- Composite index for the notifyOverdueTasks query to prevent full table scans.
CREATE INDEX IF NOT EXISTS idx_application_tasks_overdue 
ON career_operations.application_tasks (status, due_date) 
WHERE reminder_sent = FALSE;

-- Composite index for deadline_events to optimize the sendDeadlineEmailReminders query.
-- (V20 had an index on remind_at, but the service uses event_date between now and 24h)
CREATE INDEX IF NOT EXISTS idx_deadline_events_upcoming
ON career_operations.deadline_events (event_date)
WHERE reminder_sent = FALSE;
