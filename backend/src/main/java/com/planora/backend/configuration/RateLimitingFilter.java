package com.planora.backend.configuration;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.ServletInputStream;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.web.util.matcher.IpAddressMatcher;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Centralized, multi-instance-safe rate limiter for sensitive auth endpoints.
 *
 * <p><strong>Throttle policy (single authority — no service-layer duplication):</strong>
 * <ul>
 *   <li>{@code /api/auth/forgot}, {@code /api/auth/resend}, {@code /api/auth/resend-otp} —
 *       5 requests / 10 minutes, keyed on <em>IP + email</em> (OTP-issuance bucket).</li>
 *   <li>{@code /api/auth/reset} — 5 requests / 15 minutes, keyed on <em>IP + email</em>.</li>
 *   <li>{@code /api/projects/{id}/invitations} — 10 requests / hour, keyed on <em>projectId + IP</em>.</li>
 *   <li>All other rate-limited auth paths — 5 requests / minute, keyed on <em>IP + path</em>.</li>
 * </ul>
 *
 * <p><strong>Backend:</strong> Redis INCR + EXPIRE (via {@link StringRedisTemplate}) so counters are
 * shared across all application instances. If Redis is unavailable the filter <em>fails open</em>
 * (the request is allowed through) and logs a warning — identical to the graceful-degradation
 * strategy used by {@code NotificationService}.
 */
@Component
@Slf4j
public class RateLimitingFilter extends OncePerRequestFilter {

    // -------------------------------------------------------------------------
    // Limits
    // -------------------------------------------------------------------------
    @Value("${app.security.rate-limit.auth-per-minute:5}")
    private int maxRequestsPerMinute = 5;
    @Value("${app.security.rate-limit.invitation-per-hour:10}")
    private int maxInvitationsPerHour = 10;
    @Value("${app.security.rate-limit.reset-per-15-minutes:5}")
    private int maxResetsPer15Minutes = 5;
    @Value("${app.security.rate-limit.otp-per-10-minutes:5}")
    private int maxOtpPer10Minutes = 5;
    @Value("${app.security.rate-limit.expensive-per-minute:30}")
    private int maxExpensiveRequestsPerMinute = 30;
    @Value("${app.security.rate-limit.fail-open:true}")
    private boolean failOpen = true;

    // -------------------------------------------------------------------------
    // TTLs matching the limits above
    // -------------------------------------------------------------------------
    private static final Duration TTL_GENERIC     = Duration.ofMinutes(1);
    private static final Duration TTL_INVITATION  = Duration.ofHours(1);
    private static final Duration TTL_RESET       = Duration.ofMinutes(15);
    private static final Duration TTL_OTP         = Duration.ofMinutes(10);

    // -------------------------------------------------------------------------
    // Path matching
    // -------------------------------------------------------------------------
    private static final Pattern PROJECT_INVITE_PATH = Pattern.compile("^/api/projects/(\\d+)/invitations$");
    private static final List<Pattern> EXPENSIVE_PATHS = List.of(
            Pattern.compile("^/api/auth/refresh$"),
            Pattern.compile("^/api/github/webhooks?$") ,
            Pattern.compile("^/api/projects/\\d+/documents/(?:upload|uploads)(?:/.*)?$"),
            Pattern.compile("^/api/tasks/\\d+/attachments/upload(?:/.*)?$"),
            Pattern.compile("^/api/reports(?:/.*)?$"),
            Pattern.compile("^/api/scheduled-reports(?:/.*)?$"),
            Pattern.compile("^/api/search(?:/.*)?$"),
            Pattern.compile("^/api/tasks/(?:bulk(?:/.*)?|kanban/move|reorder)$")
    );

    private static final List<String> RATE_LIMITED_PATHS = List.of(
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/reg/verify",
            "/api/auth/forgot",
            "/api/auth/resend",
            "/api/auth/resend-otp",
            "/api/auth/reset"
    );

    /** Paths whose bodies must be parsed for an {@code email} field. */
    private static final List<String> OTP_PATHS = List.of(
            "/api/auth/forgot",
            "/api/auth/resend",
            "/api/auth/resend-otp"
    );

    // -------------------------------------------------------------------------
    // Dependencies
    // -------------------------------------------------------------------------

    /**
     * Optional to remain unit-testable without a running Redis server.
     * When null the filter falls back to fail-open behaviour.
     */
    @Autowired(required = false)
    private StringRedisTemplate stringRedisTemplate;

    private final List<IpAddressMatcher> trustedProxyMatchers;

    // -------------------------------------------------------------------------
    // Constructors
    // -------------------------------------------------------------------------

    public RateLimitingFilter() {
        this("127.0.0.1,::1");
    }

    public RateLimitingFilter(
            @Value("${app.security.trusted-proxies:127.0.0.1,::1}") String trustedProxiesProperty) {
        String properties = (trustedProxiesProperty == null || trustedProxiesProperty.isBlank())
                ? "127.0.0.1,::1"
                : trustedProxiesProperty;
        this.trustedProxyMatchers = java.util.Arrays.stream(properties.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(IpAddressMatcher::new)
                .toList();
    }

    // -------------------------------------------------------------------------
    // Filter logic
    // -------------------------------------------------------------------------

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        if (isProjectInviteRequest(request)) {
            return false;
        }
        return RATE_LIMITED_PATHS.stream().noneMatch(path::equals) && !isExpensiveRequest(request);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String rateLimitKey;
        int limit;
        HttpServletRequest requestToProcess = request;

        if (isResetPasswordRequest(request)) {
            // -----------------------------------------------------------------
            // /api/auth/reset  →  key: reset:{ip}:{email}
            // -----------------------------------------------------------------
            CachedBodyHttpServletRequest wrapped = new CachedBodyHttpServletRequest(request);
            requestToProcess = wrapped;
            String email = extractEmailFromBody(wrapped.getCachedBody());
            rateLimitKey = "reset:" + resolveClientIp(wrapped) + ":" + email;
            limit = maxResetsPer15Minutes;

            if (isRateLimited(rateLimitKey, limit, TTL_RESET)) {
                rejectWithTooManyRequests(response, request, TTL_RESET,
                        "Too many password reset attempts. Please try again in 15 minutes.");
                return;
            }

        } else if (isOtpRequest(request)) {
            // -----------------------------------------------------------------
            // /api/auth/forgot|resend|resend-otp  →  key: otp:{ip}:{email}
            // -----------------------------------------------------------------
            CachedBodyHttpServletRequest wrapped = new CachedBodyHttpServletRequest(request);
            requestToProcess = wrapped;
            String email = extractEmailFromBody(wrapped.getCachedBody());
            rateLimitKey = "otp:" + resolveClientIp(wrapped) + ":" + email;
            limit = maxOtpPer10Minutes;

            if (isRateLimited(rateLimitKey, limit, TTL_OTP)) {
                rejectWithTooManyRequests(response, request, TTL_OTP,
                        "Too many OTP requests. Please try again in 10 minutes.");
                return;
            }

        } else if (isProjectInviteRequest(request)) {
            // -----------------------------------------------------------------
            // /api/projects/{id}/invitations  →  key: invite:{projectId}:{ip}
            // -----------------------------------------------------------------
            Matcher m = PROJECT_INVITE_PATH.matcher(request.getServletPath());
            String projectId = m.find() ? m.group(1) : "unknown";
            rateLimitKey = "invite:" + projectId + ":" + resolveClientIp(request);
            limit = maxInvitationsPerHour;

            if (isRateLimited(rateLimitKey, limit, TTL_INVITATION)) {
                rejectWithTooManyRequests(response, request, TTL_INVITATION,
                        "Too many invitations sent, try again in 1 hour");
                return;
            }

        } else {
            // -----------------------------------------------------------------
            // Generic auth paths  →  key: auth:{ip}:{path}
            // -----------------------------------------------------------------
            boolean expensive = isExpensiveRequest(request);
            rateLimitKey = (expensive ? "expensive:" : "auth:") + resolveClientIp(request) + ":" + request.getServletPath();
            limit = expensive ? maxExpensiveRequestsPerMinute : maxRequestsPerMinute;

            if (isRateLimited(rateLimitKey, limit, TTL_GENERIC)) {
                rejectWithTooManyRequests(response, request, TTL_GENERIC,
                        "Too many requests. Please try again later.");
                return;
            }
        }

        filterChain.doFilter(requestToProcess, response);
    }

    // -------------------------------------------------------------------------
    // Redis counter helpers
    // -------------------------------------------------------------------------

    /**
     * Atomically increments the counter for {@code key} and sets its TTL on the first
     * increment. Returns {@code true} when the counter has exceeded {@code limit},
     * meaning the request should be rejected.
     *
     * <p>Fails open (returns {@code false}) when Redis is unavailable, logging a warning.
     */
    boolean isRateLimited(String key, int limit, Duration ttl) {
        if (stringRedisTemplate == null) {
            // No Redis wired (e.g. unit-test context without a mock) — allow through.
            log.debug("StringRedisTemplate not available; rate-limit check skipped for key={}", key);
            return unavailable(key, null);
        }
        try {
            Long count = stringRedisTemplate.opsForValue().increment(key);
            if (count == null) {
                log.warn("Redis INCR returned null for key={}; allowing request", key);
                return unavailable(key, null);
            }
            if (count == 1L) {
                // First increment — set expiry so the key self-cleans after the window.
                stringRedisTemplate.expire(key, ttl);
            }
            if (count > limit) {
                log.warn("Rate limit exceeded: key={} count={} limit={}", key, count, limit);
                return true;
            }
            return false;
        } catch (RuntimeException ex) {
            return unavailable(key, ex);
        }
    }

    private boolean unavailable(String key, RuntimeException exception) {
        String detail = exception == null ? "StringRedisTemplate not available" : exception.getMessage();
        if (failOpen) {
            log.warn("Rate-limit backend unavailable for key={}; allowing request: {}", key, detail);
            return false;
        }
        log.error("Rate-limit backend unavailable for key={}; rejecting sensitive request: {}", key, detail);
        return true;
    }

    // -------------------------------------------------------------------------
    // Request classification helpers
    // -------------------------------------------------------------------------

    private boolean isResetPasswordRequest(HttpServletRequest request) {
        return "POST".equalsIgnoreCase(request.getMethod())
                && "/api/auth/reset".equals(request.getServletPath());
    }

    private boolean isOtpRequest(HttpServletRequest request) {
        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            return false;
        }
        return OTP_PATHS.contains(request.getServletPath());
    }

    private boolean isProjectInviteRequest(HttpServletRequest request) {
        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            return false;
        }
        return PROJECT_INVITE_PATH.matcher(request.getServletPath()).matches();
    }

    private boolean isExpensiveRequest(HttpServletRequest request) {
        String method = request.getMethod();
        if (!("POST".equalsIgnoreCase(method) || "PUT".equalsIgnoreCase(method)
                || "PATCH".equalsIgnoreCase(method) || "DELETE".equalsIgnoreCase(method)
                || "GET".equalsIgnoreCase(method))) {
            return false;
        }
        return EXPENSIVE_PATHS.stream().anyMatch(pattern -> pattern.matcher(request.getServletPath()).matches());
    }

    // -------------------------------------------------------------------------
    // Body parsing helpers
    // -------------------------------------------------------------------------

    /**
     * Extracts the {@code email} field from a JSON request body.
     * Returns {@code "unknown"} if the body cannot be parsed or the field is absent.
     */
    private String extractEmailFromBody(byte[] body) {
        if (body == null || body.length == 0) {
            return "unknown";
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> map = new com.fasterxml.jackson.databind.ObjectMapper()
                    .readValue(body, Map.class);
            if (map != null && map.get("email") != null) {
                return map.get("email").toString().trim().toLowerCase();
            }
        } catch (Exception e) {
            log.warn("Failed to parse email from request body for rate-limit keying", e);
        }
        return "unknown";
    }

    // -------------------------------------------------------------------------
    // Response helper
    // -------------------------------------------------------------------------

    private void rejectWithTooManyRequests(HttpServletResponse response,
                                           HttpServletRequest request,
                                           Duration ttl,
                                           String message) throws IOException {
        log.warn("Rate limit exceeded: uri={}", request.getRequestURI());
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader("Retry-After", Long.toString(Math.max(1, ttl.toSeconds())));
        response.setContentType("application/json");
        com.planora.backend.dto.ApiErrorResponse errorResponse = new com.planora.backend.dto.ApiErrorResponse(
                java.time.LocalDateTime.now().toString(),
                HttpStatus.TOO_MANY_REQUESTS.value(),
                "RATE_LIMIT",
                message,
                request.getRequestURI(),
                null
        );
        response.getWriter().write(
                new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(errorResponse));
    }

    // -------------------------------------------------------------------------
    // IP resolution
    // -------------------------------------------------------------------------

    private String resolveClientIp(HttpServletRequest request) {
        HttpServletRequest rawRequest = unwrapRequest(request);
        String immediatePeer = rawRequest.getRemoteAddr();

        if (isTrustedProxy(immediatePeer)) {
            String xForwardedFor = rawRequest.getHeader("X-Forwarded-For");
            if (xForwardedFor != null && !xForwardedFor.isBlank()) {
                String[] parts = xForwardedFor.split(",");
                for (int i = parts.length - 1; i >= 0; i--) {
                    String ip = parts[i].trim();
                    if (!ip.isEmpty() && !isTrustedProxy(ip)) {
                        return ip;
                    }
                }
                if (parts.length > 0) {
                    String leftmost = parts[0].trim();
                    if (!leftmost.isEmpty()) {
                        return leftmost;
                    }
                }
            }
            return request.getRemoteAddr();
        }

        return immediatePeer;
    }

    private HttpServletRequest unwrapRequest(HttpServletRequest request) {
        jakarta.servlet.ServletRequest current = request;
        while (current instanceof HttpServletRequestWrapper) {
            current = ((HttpServletRequestWrapper) current).getRequest();
        }
        return (HttpServletRequest) current;
    }

    private boolean isTrustedProxy(String ip) {
        if (ip == null || ip.isBlank()) {
            return false;
        }
        for (IpAddressMatcher matcher : trustedProxyMatchers) {
            if (matcher.matches(ip)) {
                return true;
            }
        }
        return false;
    }

    // -------------------------------------------------------------------------
    // Inner classes — body caching (unchanged)
    // -------------------------------------------------------------------------

    static class CachedBodyHttpServletRequest extends HttpServletRequestWrapper {
        private final byte[] cachedBody;

        public CachedBodyHttpServletRequest(HttpServletRequest request) throws IOException {
            super(request);
            this.cachedBody = request.getInputStream().readAllBytes();
        }

        public byte[] getCachedBody() {
            return cachedBody;
        }

        @Override
        public ServletInputStream getInputStream() throws IOException {
            return new CachedBodyServletInputStream(this.cachedBody);
        }

        @Override
        public BufferedReader getReader() throws IOException {
            return new BufferedReader(new InputStreamReader(new ByteArrayInputStream(this.cachedBody)));
        }
    }

    private static class CachedBodyServletInputStream extends ServletInputStream {
        private final ByteArrayInputStream cachedBodyInputStream;

        public CachedBodyServletInputStream(byte[] cachedBody) {
            this.cachedBodyInputStream = new ByteArrayInputStream(cachedBody);
        }

        @Override
        public boolean isFinished() {
            return cachedBodyInputStream.available() == 0;
        }

        @Override
        public boolean isReady() {
            return true;
        }

        @Override
        public void setReadListener(jakarta.servlet.ReadListener readListener) {
            throw new UnsupportedOperationException();
        }

        @Override
        public int read() throws IOException {
            return cachedBodyInputStream.read();
        }
    }
}
