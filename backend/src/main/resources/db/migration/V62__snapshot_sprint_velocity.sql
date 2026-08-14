ALTER TABLE sprints
    ADD COLUMN IF NOT EXISTS committed_points INTEGER,
    ADD COLUMN IF NOT EXISTS completed_points INTEGER,
    ADD COLUMN IF NOT EXISTS commitment_captured BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

-- The true start-of-sprint commitment cannot be reconstructed for historical
-- sprints. Preserve delivered velocity and let clients identify the missing
-- baseline through commitment_captured = false.
UPDATE sprints s
SET completed_points = COALESCE((
    SELECT SUM(t.story_point)
    FROM tasks t
    WHERE t.sprint_id = s.id
      AND t.archived = FALSE
      AND UPPER(t.status) = 'DONE'
), 0)
WHERE s.status = 'COMPLETED'
  AND s.completed_points IS NULL;
