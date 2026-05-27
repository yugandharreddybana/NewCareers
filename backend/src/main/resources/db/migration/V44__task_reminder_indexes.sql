-- 5.006 — Optimize overdue task scanning
SET search_path TO careerops;

CREATE INDEX IF NOT EXISTS idx_application_tasks_overdue
ON application_tasks (status, due_date);

CREATE INDEX IF NOT EXISTS idx_deadline_events_upcoming
ON deadline_events (event_date);
