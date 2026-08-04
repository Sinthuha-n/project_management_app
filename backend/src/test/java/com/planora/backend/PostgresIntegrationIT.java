package com.planora.backend;

import org.junit.jupiter.api.extension.ConditionEvaluationResult;
import org.junit.jupiter.api.extension.ExecutionCondition;
import org.junit.jupiter.api.extension.ExtensionConfigurationException;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.PostgreSQLContainer;
import org.springframework.jdbc.core.JdbcTemplate;

import com.planora.backend.support.PostgresTestCleaner;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("integration")
@ExtendWith(PostgresIntegrationIT.DockerAvailabilityCondition.class)
public abstract class PostgresIntegrationIT {

    @Autowired
    private JdbcTemplate integrationJdbcTemplate;

    protected static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16-alpine")
                    .withDatabaseName("planora_test")
                    .withUsername("testuser")
                    .withPassword("testpass");

    @DynamicPropertySource
    static void configurePostgres(DynamicPropertyRegistry registry) {
        ensurePostgresStarted();
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        registry.add("spring.flyway.enabled", () -> true);
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    }

    protected static synchronized void ensurePostgresStarted() {
        if (!POSTGRES.isRunning()) {
            POSTGRES.start();
        }
    }

    @BeforeEach
    void cleanApplicationTables() {
        PostgresTestCleaner.clean(integrationJdbcTemplate);
    }

    public static final class DockerAvailabilityCondition implements ExecutionCondition {
        @Override
        public ConditionEvaluationResult evaluateExecutionCondition(ExtensionContext context) {
            if (DockerClientFactory.instance().isDockerAvailable()) {
                return ConditionEvaluationResult.enabled("Docker is available");
            }
            if (Boolean.parseBoolean(System.getenv("CI"))) {
                throw new ExtensionConfigurationException(
                        "Docker is required for Testcontainers-backed integration tests in CI");
            }
            return ConditionEvaluationResult.disabled(
                    "Docker is unavailable; skipping Testcontainers-backed integration tests");
        }
    }
}
