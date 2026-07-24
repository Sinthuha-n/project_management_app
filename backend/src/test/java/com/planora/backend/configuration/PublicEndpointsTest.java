package com.planora.backend.configuration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashSet;

import org.junit.jupiter.api.Test;

/** Regression guard for the canonical unauthenticated-route inventory. */
class PublicEndpointsTest {

    @Test
    void publicRoutesAreUniqueAndContainOnlyApprovedEntryPoints() {
        assertEquals(PublicEndpoints.PATTERNS.size(), new HashSet<>(PublicEndpoints.PATTERNS).size());
        assertTrue(PublicEndpoints.PATTERNS.contains("/api/auth/refresh"));
        assertTrue(PublicEndpoints.PATTERNS.contains("/api/auth/resend"));
        assertTrue(PublicEndpoints.PATTERNS.contains("/api/github/webhook"));
        assertTrue(PublicEndpoints.PATTERNS.contains("/ws/**"));
        assertTrue(PublicEndpoints.PATTERNS.contains("/ws-native/**"));
        assertTrue(PublicEndpoints.PATTERNS.contains("/yjs/**"));
        assertTrue(PublicEndpoints.PATTERNS.stream().noneMatch(route -> route.equals("/**")));
    }
}
