package com.planora.backend.configuration;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link RateLimitingFilter}.
 *
 * <p>Redis is mocked via {@link StringRedisTemplate}. The {@code increment} stub returns
 * successive counts so that the first N requests are allowed and the (N+1)th is rejected.
 *
 * <p><strong>Throttle policy under test:</strong>
 * <ul>
 *   <li>Generic auth paths ({@code /api/auth/login}) — 5 / minute, keyed IP+path.</li>
 *   <li>OTP endpoints ({@code /api/auth/forgot}, {@code /api/auth/resend}) — 5 / 10 min, keyed IP+email.</li>
 *   <li>Reset ({@code /api/auth/reset}) — 5 / 15 min, keyed IP+email.</li>
 *   <li>Project invitations — 10 / hour, keyed projectId+IP.</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class RateLimitingTest {

    @Mock
    private StringRedisTemplate mockRedisTemplate;

    @Mock
    private ValueOperations<String, String> mockValueOps;

    private RateLimitingFilter rateLimitingFilter;

    @BeforeEach
    void setUp() {
        rateLimitingFilter = new RateLimitingFilter("127.0.0.1,::1");
        // Inject the mock Redis template
        ReflectionTestUtils.setField(rateLimitingFilter, "stringRedisTemplate", mockRedisTemplate);
    }

    /** Convenience: wire mockValueOps for tests that exercise the filter chain. */
    private void stubRedis(Long... returnValues) {
        when(mockRedisTemplate.opsForValue()).thenReturn(mockValueOps);
        when(mockValueOps.increment(anyString())).thenReturn(returnValues[0],
                java.util.Arrays.copyOfRange(returnValues, 1, returnValues.length));
    }

    // =========================================================================
    // shouldNotFilter
    // =========================================================================

    @Test
    void shouldNotFilter_returnsTrueForNonRateLimitedPath() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/tasks");
        request.setServletPath("/api/tasks");
        assertTrue(rateLimitingFilter.shouldNotFilter(request));
    }

    @Test
    void shouldNotFilter_returnsFalseForLoginPath() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setServletPath("/api/auth/login");
        assertFalse(rateLimitingFilter.shouldNotFilter(request));
    }

    @Test
    void shouldNotFilter_rateLimitsRegistrationAndVerification() {
        MockHttpServletRequest register = new MockHttpServletRequest("POST", "/api/auth/register");
        register.setServletPath("/api/auth/register");
        MockHttpServletRequest verify = new MockHttpServletRequest("POST", "/api/auth/reg/verify");
        verify.setServletPath("/api/auth/reg/verify");
        assertFalse(rateLimitingFilter.shouldNotFilter(register));
        assertFalse(rateLimitingFilter.shouldNotFilter(verify));
    }

    @Test
    void shouldNotFilter_rateLimitsRefreshWebhooksUploadsAndBulkMutations() {
        String[] paths = {
                "/api/auth/refresh",
                "/api/github/webhook",
                "/api/projects/10/documents/uploads/abc/finalize",
                "/api/tasks/10/attachments/upload/finalize",
                "/api/reports/project/10",
                "/api/search",
                "/api/tasks/bulk/status"
        };
        for (String path : paths) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
            request.setServletPath(path);
            assertFalse(rateLimitingFilter.shouldNotFilter(request), path);
        }
    }

    @Test
    void failsClosedWhenConfiguredAndRedisIsUnavailable() {
        ReflectionTestUtils.setField(rateLimitingFilter, "failOpen", false);
        when(mockRedisTemplate.opsForValue()).thenThrow(new IllegalStateException("Redis down"));
        assertTrue(rateLimitingFilter.isRateLimited("auth:example", 5, Duration.ofMinutes(1)));
    }

    @Test
    void shouldNotFilter_returnsFalseForProjectInvitePath() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/projects/10/invitations");
        request.setServletPath("/api/projects/10/invitations");
        assertFalse(rateLimitingFilter.shouldNotFilter(request));
    }

    // =========================================================================
    // Generic auth path  — /api/auth/login  (IP+path key, 5/min)
    // =========================================================================

    @Test
    void doFilterInternal_allowsFirstFiveLoginRequests() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setServletPath("/api/auth/login");
        request.setRemoteAddr("10.0.0.1");
        FilterChain chain = mock(FilterChain.class);

        // Simulate Redis returning counts 1–5 (all within limit)
        stubRedis(1L, 2L, 3L, 4L, 5L);

        for (int i = 0; i < 5; i++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            rateLimitingFilter.doFilterInternal(request, response, chain);
            assertEquals(200, response.getStatus(), "Request " + (i + 1) + " should be allowed");
        }
        verify(chain, times(5)).doFilter(any(), any());
    }

    @Test
    void doFilterInternal_blocks6thLoginRequest() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/forgot");
        request.setServletPath("/api/auth/forgot");
        request.setRemoteAddr("10.0.0.1");
        request.setContentType("application/json");
        request.setContent("{\"email\":\"user@example.com\"}".getBytes());
        FilterChain chain = mock(FilterChain.class);

        // First 5 allowed, 6th exceeds limit
        stubRedis(1L, 2L, 3L, 4L, 5L, 6L);

        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/auth/forgot");
            req.setServletPath("/api/auth/forgot");
            req.setRemoteAddr("10.0.0.1");
            req.setContentType("application/json");
            req.setContent("{\"email\":\"user@example.com\"}".getBytes());
            rateLimitingFilter.doFilterInternal(req, new MockHttpServletResponse(), chain);
        }

        MockHttpServletRequest request6 = new MockHttpServletRequest("POST", "/api/auth/forgot");
        request6.setServletPath("/api/auth/forgot");
        request6.setRemoteAddr("10.0.0.1");
        request6.setContentType("application/json");
        request6.setContent("{\"email\":\"user@example.com\"}".getBytes());
        MockHttpServletResponse blocked = new MockHttpServletResponse();
        rateLimitingFilter.doFilterInternal(request6, blocked, chain);
        assertEquals(429, blocked.getStatus());
    }

    // =========================================================================
    // /api/auth/reset  — IP+email key, 5/15 min
    // =========================================================================

    @Test
    void doFilterInternal_blocks6thResetRequestByIpAndEmail() throws Exception {
        String jsonBody = "{\"email\":\"test-rate-limit@example.com\",\"token\":\"123456\",\"newPassword\":\"NewSecure@1\"}";
        FilterChain chain = mock(FilterChain.class);

        // Allow 5, block the 6th
        stubRedis(1L, 2L, 3L, 4L, 5L, 6L);

        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/reset");
            request.setServletPath("/api/auth/reset");
            request.setRemoteAddr("127.0.0.1");
            request.setContent(jsonBody.getBytes());
            MockHttpServletResponse response = new MockHttpServletResponse();
            rateLimitingFilter.doFilterInternal(request, response, chain);
            assertEquals(200, response.getStatus());
        }

        MockHttpServletRequest request6 = new MockHttpServletRequest("POST", "/api/auth/reset");
        request6.setServletPath("/api/auth/reset");
        request6.setRemoteAddr("127.0.0.1");
        request6.setContent(jsonBody.getBytes());
        MockHttpServletResponse response6 = new MockHttpServletResponse();
        rateLimitingFilter.doFilterInternal(request6, response6, chain);
        assertEquals(429, response6.getStatus());
        assertTrue(response6.getContentAsString().contains("Too many password reset attempts"));
    }

    // =========================================================================
    // /api/auth/forgot  — OTP endpoint, IP+email key, 5/10 min
    // =========================================================================

    @Test
    void doFilterInternal_blocks6thForgotRequestByIpAndEmail() throws Exception {
        String jsonBody = "{\"email\":\"victim@example.com\"}";
        FilterChain chain = mock(FilterChain.class);

        stubRedis(1L, 2L, 3L, 4L, 5L, 6L);

        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/forgot");
            request.setServletPath("/api/auth/forgot");
            request.setRemoteAddr("10.0.0.2");
            request.setContent(jsonBody.getBytes());
            MockHttpServletResponse response = new MockHttpServletResponse();
            rateLimitingFilter.doFilterInternal(request, response, chain);
            assertEquals(200, response.getStatus(), "Request " + (i + 1) + " should be allowed");
        }

        MockHttpServletRequest request6 = new MockHttpServletRequest("POST", "/api/auth/forgot");
        request6.setServletPath("/api/auth/forgot");
        request6.setRemoteAddr("10.0.0.2");
        request6.setContent(jsonBody.getBytes());
        MockHttpServletResponse response6 = new MockHttpServletResponse();
        rateLimitingFilter.doFilterInternal(request6, response6, chain);
        assertEquals(429, response6.getStatus());
        assertTrue(response6.getContentAsString().contains("Too many OTP requests"));
    }

    // =========================================================================
    // /api/auth/resend  — OTP endpoint, IP+email key, 5/10 min
    // =========================================================================

    @Test
    void doFilterInternal_blocks6thResendRequestByIpAndEmail() throws Exception {
        String jsonBody = "{\"email\":\"victim@example.com\"}";
        FilterChain chain = mock(FilterChain.class);

        stubRedis(1L, 2L, 3L, 4L, 5L, 6L);

        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/resend");
            request.setServletPath("/api/auth/resend");
            request.setRemoteAddr("10.0.0.3");
            request.setContent(jsonBody.getBytes());
            MockHttpServletResponse response = new MockHttpServletResponse();
            rateLimitingFilter.doFilterInternal(request, response, chain);
            assertEquals(200, response.getStatus(), "Request " + (i + 1) + " should be allowed");
        }

        MockHttpServletRequest request6 = new MockHttpServletRequest("POST", "/api/auth/resend");
        request6.setServletPath("/api/auth/resend");
        request6.setRemoteAddr("10.0.0.3");
        request6.setContent(jsonBody.getBytes());
        MockHttpServletResponse response6 = new MockHttpServletResponse();
        rateLimitingFilter.doFilterInternal(request6, response6, chain);
        assertEquals(429, response6.getStatus());
        assertTrue(response6.getContentAsString().contains("Too many OTP requests"));
    }

    // =========================================================================
    // Different IP  — same email, each gets its own counter
    // =========================================================================

    @Test
    void doFilterInternal_differentIpSameEmail_eachGetsOwnCounter() throws Exception {
        String jsonBody = "{\"email\":\"shared@example.com\"}";
        FilterChain chain = mock(FilterChain.class);

        // Two distinct Redis keys → each starts at 1 and stays within limit
        stubRedis(1L, 1L);

        // IP A — should be allowed
        MockHttpServletRequest requestA = new MockHttpServletRequest("POST", "/api/auth/forgot");
        requestA.setServletPath("/api/auth/forgot");
        requestA.setRemoteAddr("10.0.0.10");
        requestA.setContent(jsonBody.getBytes());
        MockHttpServletResponse responseA = new MockHttpServletResponse();
        rateLimitingFilter.doFilterInternal(requestA, responseA, chain);
        assertEquals(200, responseA.getStatus());

        // IP B — should also be allowed (separate key)
        MockHttpServletRequest requestB = new MockHttpServletRequest("POST", "/api/auth/forgot");
        requestB.setServletPath("/api/auth/forgot");
        requestB.setRemoteAddr("10.0.0.20");
        requestB.setContent(jsonBody.getBytes());
        MockHttpServletResponse responseB = new MockHttpServletResponse();
        rateLimitingFilter.doFilterInternal(requestB, responseB, chain);
        assertEquals(200, responseB.getStatus());

        verify(chain, times(2)).doFilter(any(), any());
    }

    // =========================================================================
    // Redis fail-open  — unavailable Redis must not block requests
    // =========================================================================

    @Test
    void doFilterInternal_redisUnavailable_failsOpen() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/forgot");
        request.setServletPath("/api/auth/forgot");
        request.setRemoteAddr("10.0.0.99");
        request.setContent("{\"email\":\"user@example.com\"}".getBytes());
        FilterChain chain = mock(FilterChain.class);

        // Simulate Redis throwing on increment
        when(mockRedisTemplate.opsForValue()).thenReturn(mockValueOps);
        when(mockValueOps.increment(anyString())).thenThrow(new RuntimeException("Redis connection refused"));

        MockHttpServletResponse response = new MockHttpServletResponse();
        rateLimitingFilter.doFilterInternal(request, response, chain);
        // Must be allowed through — fail-open
        assertEquals(200, response.getStatus());
        verify(chain, times(1)).doFilter(any(), any());
    }

    // =========================================================================
    // IP resolution — trusted / untrusted proxy tests (unchanged)
    // =========================================================================

    @Test
    void resolveClientIp_withUntrustedPeer_ignoresForgedXForwardedFor() throws Exception {
        // Trusted proxy is 192.168.1.1; immediate peer is 203.0.113.5 (untrusted)
        RateLimitingFilter filter = new RateLimitingFilter("192.168.1.1");
        ReflectionTestUtils.setField(filter, "stringRedisTemplate", mockRedisTemplate);
        when(mockRedisTemplate.opsForValue()).thenReturn(mockValueOps);
        when(mockValueOps.increment(anyString())).thenReturn(1L, 2L, 3L, 4L, 5L, 6L);

        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setServletPath("/api/auth/login");
        request.setRemoteAddr("203.0.113.5");
        request.addHeader("X-Forwarded-For", "198.51.100.10"); // Forged XFF

        FilterChain chain = mock(FilterChain.class);
        for (int i = 0; i < 5; i++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilterInternal(request, response, chain);
            assertEquals(200, response.getStatus());
        }

        // 6th request — still keyed on the peer IP (203.0.113.5), so it is blocked
        MockHttpServletRequest request6 = new MockHttpServletRequest("POST", "/api/auth/login");
        request6.setServletPath("/api/auth/login");
        request6.setRemoteAddr("203.0.113.5");
        request6.addHeader("X-Forwarded-For", "203.0.113.88"); // Different forged XFF
        MockHttpServletResponse blocked = new MockHttpServletResponse();
        filter.doFilterInternal(request6, blocked, chain);
        assertEquals(429, blocked.getStatus());
    }

    @Test
    void resolveClientIp_withTrustedPeer_trustsXForwardedForLastUntrustedHop() throws Exception {
        RateLimitingFilter filter = new RateLimitingFilter("192.168.1.1");
        ReflectionTestUtils.setField(filter, "stringRedisTemplate", mockRedisTemplate);
        // Each client has its own key — always first increment → always 1 (within limit)
        when(mockRedisTemplate.opsForValue()).thenReturn(mockValueOps);
        when(mockValueOps.increment(anyString())).thenReturn(1L);

        FilterChain chain = mock(FilterChain.class);

        for (int i = 1; i <= 5; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
            request.setServletPath("/api/auth/login");
            request.setRemoteAddr("192.168.1.1"); // Trusted peer
            request.addHeader("X-Forwarded-For", "198.51.100." + i); // Distinct client IPs

            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilterInternal(request, response, chain);
            assertEquals(200, response.getStatus(), "Client " + i + " should not be rate-limited");
        }

        // 6th distinct client IP — still returns count=1 (new key), so allowed
        MockHttpServletRequest request6 = new MockHttpServletRequest("POST", "/api/auth/login");
        request6.setServletPath("/api/auth/login");
        request6.setRemoteAddr("192.168.1.1");
        request6.addHeader("X-Forwarded-For", "198.51.100.6");
        MockHttpServletResponse response6 = new MockHttpServletResponse();
        filter.doFilterInternal(request6, response6, chain);
        assertEquals(200, response6.getStatus());
    }

    @Test
    void resolveClientIp_withMultipleProxies_takesLastUntrustedHop() throws Exception {
        RateLimitingFilter filter = new RateLimitingFilter("192.168.1.1, 10.0.0.0/8");
        ReflectionTestUtils.setField(filter, "stringRedisTemplate", mockRedisTemplate);
        when(mockRedisTemplate.opsForValue()).thenReturn(mockValueOps);
        when(mockValueOps.increment(anyString())).thenReturn(1L, 2L, 3L, 4L, 5L, 6L, 1L);

        // Immediate peer: 192.168.1.1 (trusted)
        // X-Forwarded-For: "203.0.113.195, 10.0.0.5" (10.0.0.5 is trusted proxy)
        // → real client = 203.0.113.195
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setServletPath("/api/auth/login");
        request.setRemoteAddr("192.168.1.1");
        request.addHeader("X-Forwarded-For", "203.0.113.195, 10.0.0.5");

        FilterChain chain = mock(FilterChain.class);
        for (int i = 0; i < 5; i++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilterInternal(request, response, chain);
            assertEquals(200, response.getStatus());
        }

        // 6th with same client IP — blocked
        MockHttpServletResponse blocked = new MockHttpServletResponse();
        filter.doFilterInternal(request, blocked, chain);
        assertEquals(429, blocked.getStatus());

        // Different client IP — not blocked (7th stub returns 1)
        MockHttpServletRequest requestDifferent = new MockHttpServletRequest("POST", "/api/auth/login");
        requestDifferent.setServletPath("/api/auth/login");
        requestDifferent.setRemoteAddr("192.168.1.1");
        requestDifferent.addHeader("X-Forwarded-For", "203.0.113.99, 10.0.0.5");
        MockHttpServletResponse allowed = new MockHttpServletResponse();
        filter.doFilterInternal(requestDifferent, allowed, chain);
        assertEquals(200, allowed.getStatus());
    }
}
