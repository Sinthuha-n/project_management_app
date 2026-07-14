package com.planora.backend.support;

import java.util.stream.Collectors;

import org.springframework.jdbc.core.JdbcTemplate;

/** Removes application data while preserving Flyway's schema history. */
public final class PostgresTestCleaner {

    private PostgresTestCleaner() {
    }

    public static void clean(JdbcTemplate jdbcTemplate) {
        var tables = jdbcTemplate.queryForList(
                "select tablename from pg_tables where schemaname=current_schema() and tablename <> 'flyway_schema_history'",
                String.class);
        if (tables.isEmpty()) return;
        String quotedTables = tables.stream()
                .map(PostgresTestCleaner::quoteIdentifier)
                .collect(Collectors.joining(", "));
        jdbcTemplate.execute("truncate table " + quotedTables + " restart identity cascade");
    }

    private static String quoteIdentifier(String identifier) {
        return '"' + identifier.replace("\"", "\"\"") + '"';
    }
}
