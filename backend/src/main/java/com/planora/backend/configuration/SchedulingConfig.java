package com.planora.backend.configuration;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Enables Spring's scheduled task execution conditionally.
 * Allows disabling background scheduler threads in integration tests
 * (via {@code spring.task.scheduling.enabled=false}) to prevent race
 * conditions and deadlocks with table truncation.
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(
        name = "spring.task.scheduling.enabled",
        havingValue = "true",
        matchIfMissing = true
)
public class SchedulingConfig {
}
