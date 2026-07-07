CREATE INDEX IF NOT EXISTS idx_team_members_user_team
    ON team_members (user_id, team_id);

CREATE INDEX IF NOT EXISTS idx_project_access_user_last_project
    ON project_access (user_id, last_accessed_at DESC, project_id);

CREATE INDEX IF NOT EXISTS idx_project_favorites_user_created_project
    ON project_favorites (user_id, created_at DESC, project_id);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
    ON notifications (recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
    ON notifications (recipient_id, created_at DESC)
    WHERE is_read = false;
