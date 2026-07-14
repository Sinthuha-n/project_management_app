package com.planora.backend;

import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.jdbc.core.JdbcTemplate;

import com.planora.backend.support.PostgresTestCleaner;

/** PostgreSQL-backed repository slice. Concrete classes must end in {@code IT}. */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("integration")
@ExtendWith(PostgresIntegrationIT.DockerAvailabilityCondition.class)
public abstract class PostgresDataJpaIT {

    @Autowired
    private JdbcTemplate integrationJdbcTemplate;

    @DynamicPropertySource
    static void configurePostgres(DynamicPropertyRegistry registry) {
        PostgresIntegrationIT.ensurePostgresStarted();
        registry.add("spring.datasource.url", PostgresIntegrationIT.POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", PostgresIntegrationIT.POSTGRES::getUsername);
        registry.add("spring.datasource.password", PostgresIntegrationIT.POSTGRES::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        registry.add("spring.flyway.enabled", () -> true);
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    }

    @BeforeEach
    void cleanApplicationTables() {
        PostgresTestCleaner.clean(integrationJdbcTemplate);
    }
}
