ALTER TABLE users ADD COLUMN IF NOT EXISTS github_user_id BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_github_user_id
    ON users (github_user_id)
    WHERE github_user_id IS NOT NULL;
