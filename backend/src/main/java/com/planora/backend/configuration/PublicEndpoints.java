package com.planora.backend.configuration;

import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Single source of truth for all URL patterns that bypass JWT authentication.
 *
 * <p>Both {@link SecurityConfig} (Spring Security's permit-all list) and
 * {@link JwtFilter} (the pre-filter skip list) reference this constant so
 * there is no chance of the two diverging.</p>
 *
 * <p>Rules for adding entries:
 * <ul>
 *   <li>Use Ant-style wildcards where needed (e.g. {@code /v3/api-docs/**}).</li>
 *   <li>Only add endpoints that genuinely require no authentication — treat
 *       every addition as a security decision.</li>
 * </ul>
 */
@Component
public class PublicEndpoints {

    /**
     * Ordered list of public endpoint patterns.
     *
     * <p>Kept as a {@code List} so callers can trivially convert to an array
     * ({@code toArray(new String[0])}) for Spring Security's
     * {@code requestMatchers()} or stream over it in the JWT filter.</p>
     */
    public static final List<String> PATTERNS = List.of(
            // ── Authentication flows ──────────────────────────────────────────
            "/api/auth/register",
            "/api/auth/reg/verify",
            "/api/auth/login",
            "/api/auth/logout",       // Logout is idempotent — no valid token required
            "/api/auth/resend",
            "/api/auth/forgot",
            "/api/auth/reset",
            "/api/auth/refresh",
            "/api/auth/users/*/photo",

            // ── GitHub integration ────────────────────────────────────────────
            "/api/github/webhook",    // GitHub webhook deliveries carry no JWT
            "/api/github/webhooks",   // Alternate plural form used by some webhook configs

            // ── WebSocket transports ──────────────────────────────────────────
            "/ws/**",
            "/ws-native/**",
            "/yjs/**",

            // ── Platform health checks ────────────────────────────────────────
            "/actuator/health/**",
            "/actuator/info",

            // ── API documentation ─────────────────────────────────────────────
            "/v3/api-docs/**",
            "/swagger-ui/**",
            "/swagger-ui.html"
    );

    // Prevent instantiation — all state is static.
    private PublicEndpoints() {}
}
