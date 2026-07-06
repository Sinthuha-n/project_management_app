package com.planora.backend.configuration;

import com.zaxxer.hikari.HikariDataSource;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

@Component
public class HikariRuntimeGuard {

    private static final Logger logger = LoggerFactory.getLogger(HikariRuntimeGuard.class);
    private static final int DEV_MIN_POOL_SIZE = 8;

    /*
     * Production currently runs one EC2 backend instance with a 12-connection Hikari pool.
     * The default 15-connection budget is deliberately safe for the smallest Supabase
     * Supavisor backend pool (15) and well below its smallest Postgres max_connections (60).
     * Set DB_POOL_INSTANCE_COUNT and DB_POOL_CONNECTION_BUDGET from the provider dashboard
     * before scaling instances or changing the Supavisor/Postgres connection allocation.
     */
    private static final int DEFAULT_PROD_INSTANCE_COUNT = 1;
    private static final int DEFAULT_PROD_CONNECTION_BUDGET = 15;

    private final DataSource dataSource;
    private final Environment environment;

    public HikariRuntimeGuard(DataSource dataSource, Environment environment) {
        this.dataSource = dataSource;
        this.environment = environment;
    }

    @PostConstruct
    public void logRuntimePoolConfiguration() {
        HikariDataSource hikari = resolveHikariDataSource();
        if (hikari == null) {
            logger.info("Datasource is not HikariCP (type={}), skipping runtime pool guard", dataSource.getClass().getName());
            return;
        }

        logger.info(
                "Hikari runtime config resolved: maxPoolSize={}, minIdle={}, connectionTimeoutMs={}, validationTimeoutMs={}, maxLifetimeMs={}, keepaliveTimeMs={}, leakDetectionThresholdMs={}",
                hikari.getMaximumPoolSize(),
                hikari.getMinimumIdle(),
                hikari.getConnectionTimeout(),
                hikari.getValidationTimeout(),
                hikari.getMaxLifetime(),
                hikari.getKeepaliveTime(),
                hikari.getLeakDetectionThreshold()
        );

        if (environment.acceptsProfiles(Profiles.of("dev")) && hikari.getMaximumPoolSize() < DEV_MIN_POOL_SIZE) {
            throw new IllegalStateException(
                    "Unsafe dev Hikari max pool size detected: " + hikari.getMaximumPoolSize()
                            + " (minimum required " + DEV_MIN_POOL_SIZE + "). "
                            + "Update DB_POOL_MAX_SIZE or SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE."
            );
        }

        if (environment.acceptsProfiles(Profiles.of("prod"))) {
            validateProductionConfiguration(hikari);
        }
    }

    private void validateProductionConfiguration(HikariDataSource hikari) {
        int instanceCount = environment.getProperty(
                "app.database.pool.instance-count", Integer.class, DEFAULT_PROD_INSTANCE_COUNT);
        int connectionBudget = environment.getProperty(
                "app.database.pool.connection-budget", Integer.class, DEFAULT_PROD_CONNECTION_BUDGET);

        if (instanceCount < 1 || connectionBudget < 1) {
            throw new IllegalStateException(
                    "Production database pool instance count and connection budget must both be positive"
            );
        }

        long requestedConnections = (long) hikari.getMaximumPoolSize() * instanceCount;
        if (requestedConnections > connectionBudget) {
            throw new IllegalStateException(
                    "Unsafe production Hikari connection budget: maxPoolSize=" + hikari.getMaximumPoolSize()
                            + " x instanceCount=" + instanceCount
                            + " requests " + requestedConnections
                            + " connections, exceeding the configured budget of " + connectionBudget
                            + ". Update DB_POOL_MAX_SIZE, DB_POOL_INSTANCE_COUNT, or "
                            + "DB_POOL_CONNECTION_BUDGET to match the database/pooler ceiling."
            );
        }

        if (hikari.getLeakDetectionThreshold() < 2_000L) {
            throw new IllegalStateException(
                    "Production Hikari leak detection must be enabled with a threshold of at least 2000ms; "
                            + "set DB_POOL_LEAK_DETECTION_THRESHOLD (recommended: 60000ms)."
            );
        }

        logger.info(
                "Production Hikari connection budget verified: maxPoolSize={} x instanceCount={} = {} <= {}",
                hikari.getMaximumPoolSize(), instanceCount, requestedConnections, connectionBudget
        );
    }

    private HikariDataSource resolveHikariDataSource() {
        if (dataSource instanceof HikariDataSource hikariDataSource) {
            return hikariDataSource;
        }
        try {
            if (dataSource.isWrapperFor(HikariDataSource.class)) {
                return dataSource.unwrap(HikariDataSource.class);
            }
        } catch (Exception ex) {
            logger.debug("Failed to unwrap HikariDataSource from {}", dataSource.getClass().getName(), ex);
        }
        return null;
    }
}
