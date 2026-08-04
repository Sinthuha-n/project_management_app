CREATE TABLE document_upload_reservations (
    upload_id    VARCHAR(36) PRIMARY KEY,
    batch_id     VARCHAR(36) NOT NULL,
    client_id    VARCHAR(100) NOT NULL,
    project_id   BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id      BIGINT NOT NULL REFERENCES users(user_id),
    folder_id    BIGINT REFERENCES document_folders(id) ON DELETE SET NULL,
    document_id  BIGINT UNIQUE REFERENCES documents(id) ON DELETE SET NULL,
    file_name    VARCHAR(255) NOT NULL,
    content_type VARCHAR(255) NOT NULL,
    file_size    BIGINT NOT NULL,
    object_key   VARCHAR(500) NOT NULL UNIQUE,
    status       VARCHAR(30) NOT NULL,
    error_code   VARCHAR(60),
    expires_at   TIMESTAMP NOT NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    finalized_at TIMESTAMP
);

CREATE INDEX idx_upload_reservation_project_status_expiry
    ON document_upload_reservations(project_id, status, expires_at);
CREATE INDEX idx_upload_reservation_batch ON document_upload_reservations(batch_id);
