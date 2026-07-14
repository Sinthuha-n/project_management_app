package com.planora.backend.configuration;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.Arrays;

@Component
@RequiredArgsConstructor
public class MobileGithubOAuthStartupValidator implements ApplicationRunner {
    private final Environment environment;

    @Value("${github.mobile.client.id:}") private String clientId;
    @Value("${github.mobile.client.secret:}") private String clientSecret;
    @Value("${github.mobile.callback-uri:}") private String callbackUri;
    @Value("${app.mobile.return-uri:}") private String mobileReturnUri;

    @Override
    public void run(ApplicationArguments args) {
        if (!isProduction()) return;
        if (clientId == null || clientId.isBlank() || clientSecret == null || clientSecret.isBlank()) {
            throw new IllegalStateException("[STARTUP] GITHUB_MOBILE_CLIENT_ID and GITHUB_MOBILE_CLIENT_SECRET are required in production");
        }
        URI callback = parse(callbackUri);
        if (callback == null || !"https".equalsIgnoreCase(callback.getScheme()) || callback.getHost() == null) {
            throw new IllegalStateException("[STARTUP] GITHUB_MOBILE_CALLBACK_URI must be a public HTTPS URL");
        }
        URI appReturn = parse(mobileReturnUri);
        if (appReturn == null || !"planora".equalsIgnoreCase(appReturn.getScheme())
                || !"github-callback".equalsIgnoreCase(appReturn.getHost())) {
            throw new IllegalStateException("[STARTUP] APP_MOBILE_RETURN_URI must be planora://github-callback");
        }
    }

    private boolean isProduction() {
        return Arrays.stream(environment.getActiveProfiles())
                .anyMatch(profile -> "prod".equalsIgnoreCase(profile) || "production".equalsIgnoreCase(profile));
    }

    private URI parse(String value) {
        try {
            return value == null || value.isBlank() ? null : URI.create(value);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
