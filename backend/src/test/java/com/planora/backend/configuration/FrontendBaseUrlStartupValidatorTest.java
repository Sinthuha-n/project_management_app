package com.planora.backend.configuration;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;

class FrontendBaseUrlStartupValidatorTest {

    @Test
    void run_whenProductionProfileAndLocalhostBaseUrl_failsFast() {
        FrontendBaseUrlStartupValidator validator = validator("prod", "http://localhost:3000");

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> validator.run(null));

        assertTrue(ex.getMessage().contains("APP_FRONTEND_BASE_URL"));
        assertTrue(ex.getMessage().contains("https://planora-pma.netlify.app"));
    }

    @Test
    void run_whenProductionProfileAndLoopbackBaseUrl_failsFast() {
        FrontendBaseUrlStartupValidator validator = validator("prod", "http://127.0.0.1:3000");

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> validator.run(null));

        assertTrue(ex.getMessage().contains("APP_FRONTEND_BASE_URL"));
    }

    @Test
    void run_whenProductionProfileAndBlankBaseUrl_failsFast() {
        FrontendBaseUrlStartupValidator validator = validator("production", "  ");

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> validator.run(null));

        assertTrue(ex.getMessage().contains("APP_FRONTEND_BASE_URL"));
    }

    @Test
    void run_whenProductionProfileAndPlaceholderBaseUrl_failsFast() {
        FrontendBaseUrlStartupValidator validator = validator("production", "https://app.yourapp.com");

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> validator.run(null));

        assertTrue(ex.getMessage().contains("APP_FRONTEND_BASE_URL"));
    }

    @Test
    void run_whenProductionProfileAndNonHttpBaseUrl_failsFast() {
        FrontendBaseUrlStartupValidator validator = validator("production", "ftp://planora-pma.netlify.app");

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> validator.run(null));

        assertTrue(ex.getMessage().contains("APP_FRONTEND_BASE_URL"));
    }

    @Test
    void run_whenProductionProfileAndProductionBaseUrl_allowsStartup() {
        FrontendBaseUrlStartupValidator validator = validator("prod", "https://planora-pma.netlify.app");

        assertDoesNotThrow(() -> validator.run(null));
    }

    @Test
    void run_whenDevProfileAndLocalhostBaseUrl_allowsStartup() {
        FrontendBaseUrlStartupValidator validator = validator("dev", "http://localhost:3000");

        assertDoesNotThrow(() -> validator.run(null));
    }

    private FrontendBaseUrlStartupValidator validator(String profile, String frontendBaseUrl) {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles(profile);
        FrontendBaseUrlStartupValidator validator = new FrontendBaseUrlStartupValidator(environment);
        ReflectionTestUtils.setField(validator, "frontendBaseUrl", frontendBaseUrl);
        return validator;
    }
}
