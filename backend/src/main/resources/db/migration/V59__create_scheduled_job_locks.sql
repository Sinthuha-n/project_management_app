-- Coordinates scheduled work across multiple application instances.  Locks are
-- deliberately lease-based so a crashed instance cannot block a job forever.
CREATE TABLE scheduled_job_locks (
    job_name VARCHAR(128) PRIMARY KEY,
    locked_until TIMESTAMPTZ NOT NULL,
    locked_by VARCHAR(128) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scheduled_job_locks_locked_until
    ON scheduled_job_locks (locked_until);
