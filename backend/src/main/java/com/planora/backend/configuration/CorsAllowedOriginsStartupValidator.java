package com.planora.backend.configuration;

import java.util.Arrays;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
public class CorsAllowedOriginsStartupValidator implements ApplicationRunner {

    private final Environment environment;

    @Value("${cors.allowed-origins:}")
    private String corsAllowedOrigins;

    public CorsAllowedOriginsStartupValidator(Environment environment) {
        this.environment = environment;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!isProductionProfile()) {
            return;
        }

        if (corsAllowedOrigins == null || corsAllowedOrigins.isBlank()) {
            throw invalidConfiguration("at least one exact frontend origin is required");
        }

        String[] origins = corsAllowedOrigins.split(",", -1);
        for (String rawOrigin : origins) {
            String origin = rawOrigin.trim();
            if (origin.isEmpty()) {
                throw invalidConfiguration("empty origin entries are not allowed");
            }
            if ("*".equals(origin)) {
                throw invalidConfiguration("the bare wildcard '*' is not allowed with credentials");
            }
            if (origin.contains("*")) {
                throw invalidConfiguration(
                        "wildcard origin patterns are too broad for production: " + origin);
            }
        }
    }

    private boolean isProductionProfile() {
        return Arrays.stream(environment.getActiveProfiles())
                .anyMatch(profile -> "prod".equalsIgnoreCase(profile)
                        || "production".equalsIgnoreCase(profile));
    }

    private IllegalStateException invalidConfiguration(String reason) {
        return new IllegalStateException(
                "[STARTUP] CORS_ALLOWED_ORIGINS must contain only explicit production origins because " +
                "CORS credentials are enabled; " + reason + ".");
    }
}
