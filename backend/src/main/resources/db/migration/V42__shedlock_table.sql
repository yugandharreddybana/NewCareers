-- V42: Create ShedLock table for distributed coordination
-- 3.068, 3.069 — Required for distributed locking in horizontally scaled environments
SET search_path TO career_operations;

CREATE TABLE shedlock (
    name       VARCHAR(64) NOT NULL,
    lock_until TIMESTAMP   NOT NULL,
    locked_at  TIMESTAMP   NOT NULL,
    locked_by  VARCHAR(255) NOT NULL,
    PRIMARY KEY (name)
);
