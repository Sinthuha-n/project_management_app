CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_chat_message_content_lower_trgm
    ON chat_message USING GIN (LOWER(content) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_projects_name_lower_trgm
    ON projects USING GIN (LOWER(name) gin_trgm_ops);
