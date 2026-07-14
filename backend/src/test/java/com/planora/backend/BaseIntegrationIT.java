package com.planora.backend;

/**
 * Compatibility alias for existing integration tests. New tests should extend
 * {@link PostgresIntegrationIT} or {@link PlatformIntegrationIT} directly.
 */
@Deprecated(forRemoval = true)
public abstract class BaseIntegrationIT extends PostgresIntegrationIT {

    /** Compatibility field retained while existing tests migrate to {@code POSTGRES}. */
    protected static final org.testcontainers.containers.PostgreSQLContainer<?> postgres = POSTGRES;
}
