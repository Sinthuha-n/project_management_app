package com.planora.backend.configuration;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;

class CorsAllowedOriginsStartupValidatorTest {

    @Test
    void run_whenProductionOriginsAreBlank_failsFast() {
        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> validator("prod", "  ").run(null));

        assertTrue(ex.getMessage().contains("CORS_ALLOWED_ORIGINS"));
    }

    @Test
    void run_whenProductionOriginsContainBareWildcard_failsFast() {
        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> validator("production", "https://app.example.com,*").run(null));

        assertTrue(ex.getMessage().contains("bare wildcard"));
    }

    @Test
    void run_whenProductionOriginsContainWildcardPattern_failsFast() {
        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> validator("prod", "https://*.example.com").run(null));

        assertTrue(ex.getMessage().contains("too broad"));
    }

    @Test
    void run_whenProductionOriginsContainEmptyEntry_failsFast() {
        assertThrows(
                IllegalStateException.class,
                () -> validator("prod", "https://app.example.com,").run(null));
    }

    @Test
    void run_whenProductionOriginsAreExplicit_allowsStartup() {
        assertDoesNotThrow(() -> validator(
                "prod",
                "https://app.example.com, https://admin.example.com").run(null));
    }

    @Test
    void run_whenDevelopmentOriginUsesWildcard_allowsStartup() {
        assertDoesNotThrow(() -> validator("dev", "http://*").run(null));
    }

    private CorsAllowedOriginsStartupValidator validator(String profile, String origins) {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles(profile);
        CorsAllowedOriginsStartupValidator validator = new CorsAllowedOriginsStartupValidator(environment);
        ReflectionTestUtils.setField(validator, "corsAllowedOrigins", origins);
        return validator;
    }
}
