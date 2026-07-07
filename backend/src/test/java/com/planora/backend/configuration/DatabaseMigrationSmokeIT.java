package com.planora.backend.configuration;

import com.planora.backend.BaseIntegrationIT;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

class DatabaseMigrationSmokeIT extends BaseIntegrationIT {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void migrateAndValidateSchema() {
        assertThat(postgres.isRunning()).isTrue();
    }

    @Test
    void createsTrigramIndexesForLikeSearches() {
        Integer extensionCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM pg_extension WHERE extname = 'pg_trgm'",
                Integer.class
        );

        assertThat(extensionCount).isOne();
        assertTrigramGinIndex("idx_chat_message_content_lower_trgm", "content");
        assertTrigramGinIndex("idx_projects_name_lower_trgm", "name");
    }

    private void assertTrigramGinIndex(String indexName, String indexedColumn) {
        String indexDefinition = jdbcTemplate.queryForObject(
                "SELECT indexdef FROM pg_indexes WHERE schemaname = current_schema() AND indexname = ?",
                String.class,
                indexName
        );
        String indexExpression = jdbcTemplate.queryForObject(
                """
                SELECT pg_get_expr(i.indexprs, i.indrelid)
                FROM pg_index i
                JOIN pg_class idx ON idx.oid = i.indexrelid
                JOIN pg_namespace ns ON ns.oid = idx.relnamespace
                WHERE ns.nspname = current_schema() AND idx.relname = ?
                """,
                String.class,
                indexName
        );

        assertThat(indexDefinition)
                .containsIgnoringCase("USING gin")
                .containsIgnoringCase("gin_trgm_ops");
        assertThat(indexExpression)
                .containsIgnoringCase("lower")
                .containsIgnoringCase(indexedColumn);
    }
}
