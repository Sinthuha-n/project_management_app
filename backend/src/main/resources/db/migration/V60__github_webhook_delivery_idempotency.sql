CREATE TABLE github_webhook_deliveries (
    delivery_id VARCHAR(128) PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_github_webhook_deliveries_received_at
    ON github_webhook_deliveries (received_at);
