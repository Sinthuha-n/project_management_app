-- V23/V26 originally limited commit messages to 1,000 characters. Git permits
-- substantially larger messages, and the current entity already maps this field
-- as TEXT. Existing databases need an explicit type migration because
-- ADD COLUMN IF NOT EXISTS does not alter the legacy column.
ALTER TABLE github_commits
    ALTER COLUMN message TYPE TEXT;
