package com.planora.backend.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Records GitHub delivery IDs atomically so retried webhooks are idempotent. */
@Service
public class GithubWebhookDeliveryService {

    private final JdbcTemplate jdbcTemplate;

    public GithubWebhookDeliveryService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public boolean registerIfNew(String deliveryId, String eventType) {
        if (deliveryId == null || deliveryId.isBlank()) {
            // Retain compatibility with legacy/manual callers that do not send
            // GitHub's delivery header; official deliveries are deduplicated.
            return true;
        }
        if (deliveryId.length() > 128) {
            return false;
        }
        return jdbcTemplate.update(
                "INSERT INTO github_webhook_deliveries (delivery_id, event_type) VALUES (?, ?) "
                        + "ON CONFLICT (delivery_id) DO NOTHING",
                deliveryId, eventType == null ? "unknown" : eventType) == 1;
    }
}
