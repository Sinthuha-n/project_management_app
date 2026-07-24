package com.planora.backend.configuration;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationState;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.core.JdbcTemplate;

import com.planora.backend.PostgresIntegrationIT;

class MigrationSchemaIT extends PostgresIntegrationIT {

    @Autowired Flyway flyway;
    @Autowired JdbcTemplate jdbcTemplate;

    @Test
    void appliesEveryMigrationFromEmptyPostgresAndLeavesNoPendingOrFailedMigration() throws Exception {
        int migrationResources = new PathMatchingResourcePatternResolver()
                .getResources("classpath*:db/migration/*.sql").length;
        var all = flyway.info().all();

        assertThat(all).hasSize(migrationResources);
        assertThat(Arrays.stream(all).filter(info -> info.getState() == MigrationState.PENDING)).isEmpty();
        assertThat(Arrays.stream(all).filter(info -> info.getState() == MigrationState.FAILED)).isEmpty();

        Integer successful = jdbcTemplate.queryForObject(
                "select count(*) from flyway_schema_history where success", Integer.class);
        assertThat(successful).isEqualTo(migrationResources);
    }

    @Test
    void installsPostgresSpecificSearchAndUniquenessStructures() {
        assertThat(count("select count(*) from pg_extension where extname='pg_trgm'"))
                .isOne();
        assertThat(indexDefinition("idx_chat_message_content_lower_trgm"))
                .containsIgnoringCase("using gin").containsIgnoringCase("gin_trgm_ops");
        assertThat(indexDefinition("idx_projects_name_lower_trgm"))
                .containsIgnoringCase("using gin").containsIgnoringCase("gin_trgm_ops");
        assertThat(indexDefinition("ux_users_github_user_id"))
                .containsIgnoringCase("unique").containsIgnoringCase("where (github_user_id is not null)");
        assertThat(indexDefinition("idx_scheduled_job_locks_locked_until"))
                .containsIgnoringCase("scheduled_job_locks");
    }

    @Test
    void schemaUsesExpectedPostgresColumnTypesAndNullability() {
        assertThat(columnType("users", "github_user_id")).isEqualTo("bigint");
        assertThat(columnType("notification_preferences", "channel")).isEqualTo("character varying");
        assertThat(isNullable("users", "email")).isEqualTo("NO");
        assertThat(isNullable("tasks", "project_id")).isEqualTo("NO");
        assertThat(columnType("scheduled_job_locks", "locked_until")).isEqualTo("timestamp with time zone");
        assertThat(columnType("tasks", "version")).isEqualTo("bigint");
        assertThat(columnType("github_webhook_deliveries", "received_at")).isEqualTo("timestamp with time zone");
    }

    private int count(String sql) {
        return jdbcTemplate.queryForObject(sql, Integer.class);
    }

    private String indexDefinition(String name) {
        return jdbcTemplate.queryForObject(
                "select indexdef from pg_indexes where schemaname=current_schema() and indexname=?",
                String.class, name);
    }

    private String columnType(String table, String column) {
        return jdbcTemplate.queryForObject(
                "select data_type from information_schema.columns where table_schema=current_schema() and table_name=? and column_name=?",
                String.class, table, column);
    }

    private String isNullable(String table, String column) {
        return jdbcTemplate.queryForObject(
                "select is_nullable from information_schema.columns where table_schema=current_schema() and table_name=? and column_name=?",
                String.class, table, column);
    }
}
