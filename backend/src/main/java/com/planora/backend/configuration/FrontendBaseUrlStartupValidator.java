package com.planora.backend.configuration;

import java.net.URI;
import java.util.Arrays;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
public class FrontendBaseUrlStartupValidator implements ApplicationRunner {

    private final Environment environment;

    @Value("${app.frontend.base-url:}")
    private String frontendBaseUrl;

    public FrontendBaseUrlStartupValidator(Environment environment) {
        this.environment = environment;
    }

    @Override
    public void run(ApplicationArguments args) {
        log.info("[Startup] Frontend base URL for outbound emails: {}", maskIfBlank(frontendBaseUrl));

        if (!isProductionProfile()) {
            return;
        }

        if (!isValidProductionUrl(frontendBaseUrl)) {
            throw new IllegalStateException(
                    "[STARTUP] APP_FRONTEND_BASE_URL must be set to the public production frontend origin " +
                    "before starting the application. Use the deployed Netlify origin, for example: " +
                    "APP_FRONTEND_BASE_URL=https://planora-pma.netlify.app");
        }
    }

    private boolean isProductionProfile() {
        return Arrays.stream(environment.getActiveProfiles())
                .anyMatch(profile -> "prod".equalsIgnoreCase(profile) || "production".equalsIgnoreCase(profile));
    }

    private boolean isValidProductionUrl(String rawValue) {
        if (rawValue == null) {
            return false;
        }

        String value = rawValue.trim();
        if (value.isBlank() || value.startsWith("your-") || value.contains("yourapp.com")) {
            return false;
        }

        URI uri;
        try {
            uri = URI.create(value);
        } catch (IllegalArgumentException e) {
            return false;
        }

        String scheme = uri.getScheme();
        String host = uri.getHost();
        if (scheme == null || host == null) {
            return false;
        }

        boolean usesHttp = "http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme);
        if (!usesHttp) {
            return false;
        }

        String normalizedHost = host.toLowerCase();
        return !normalizedHost.equals("localhost") && !normalizedHost.equals("127.0.0.1");
    }

    private String maskIfBlank(String value) {
        if (value == null || value.isBlank()) {
            return "<missing>";
        }
        return value;
    }
}
