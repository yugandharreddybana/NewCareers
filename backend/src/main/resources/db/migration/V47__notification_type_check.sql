-- V47__notification_type_check.sql
ALTER TABLE career_operations.notifications
ADD CONSTRAINT chk_notifications_type 
CHECK (type IN ('SKILL_COMPLETE', 'INTERVIEW_REMINDER', 'JOB_MATCH', 'WEEKLY_DIGEST', 'SYSTEM', 'REFERRAL', 'OVERDUE_TASK'));
