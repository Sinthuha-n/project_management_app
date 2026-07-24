package com.planora.backend.service;

import java.time.Duration;
import java.time.Instant;
import java.sql.Timestamp;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * PostgreSQL-backed lease lock for @Scheduled work.  The single UPSERT is
 * atomic, making it safe when several application instances fire the same job.
 */
@Service
public class ScheduledJobLockService {

    private static final Logger log = LoggerFactory.getLogger(ScheduledJobLockService.class);

    private final JdbcTemplate jdbcTemplate;
    private final String instanceId;

    public ScheduledJobLockService(
            JdbcTemplate jdbcTemplate,
            @Value("${app.instance-id:${HOSTNAME:local}}") String configuredInstanceId) {
        this.jdbcTemplate = jdbcTemplate;
        this.instanceId = configuredInstanceId + "-" + UUID.randomUUID();
    }

    public boolean tryAcquire(String jobName, Duration lease) {
        Instant lockedUntil = Instant.now().plus(lease);
        try {
            Integer updated = jdbcTemplate.query(
                    """
                    INSERT INTO scheduled_job_locks (job_name, locked_until, locked_by, updated_at)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT (job_name) DO UPDATE
                        SET locked_until = EXCLUDED.locked_until,
                            locked_by = EXCLUDED.locked_by,
                            updated_at = CURRENT_TIMESTAMP
                      WHERE scheduled_job_locks.locked_until <= CURRENT_TIMESTAMP
                    RETURNING 1
                    """,
                    resultSet -> resultSet.next() ? resultSet.getInt(1) : null,
                    jobName, Timestamp.from(lockedUntil), instanceId);
            return updated != null;
        } catch (DataAccessException ex) {
            // A missing migration or unavailable database must never cause the
            // same scheduled work to run concurrently without coordination.
            log.error("Scheduled-job lock unavailable for {}; skipping execution", jobName, ex);
            return false;
        }
    }

    public void release(String jobName) {
        jdbcTemplate.update(
                "UPDATE scheduled_job_locks SET locked_until = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP "
                        + "WHERE job_name = ? AND locked_by = ?",
                jobName, instanceId);
    }
}
