package com.planora.backend.configuration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import com.fasterxml.jackson.databind.ObjectMapper;

class SecurityConfigCorsTest {

    @Test
    void corsConfiguration_allowsOnlyHeadersSentByWebAndMobileClients() {
        SecurityConfig securityConfig = new SecurityConfig(mock(JwtFilter.class), new ObjectMapper());
        ReflectionTestUtils.setField(
                securityConfig,
                "corsAllowedOrigins",
                " https://app.example.com, https://admin.example.com ");

        CorsConfigurationSource source = securityConfig.corsConfigurationSource();
        CorsConfiguration configuration = source.getCorsConfiguration(new MockHttpServletRequest("GET", "/api/tasks"));

        assertEquals(
                List.of("https://app.example.com", "https://admin.example.com"),
                configuration.getAllowedOriginPatterns());
        assertTrue(configuration.getAllowedHeaders().contains("Authorization"));
        assertTrue(configuration.getAllowedHeaders().contains("Content-Type"));
        assertFalse(configuration.getAllowedHeaders().contains("*"));
        assertEquals(
                List.of("authorization", "content-type"),
                configuration.checkHeaders(List.of("authorization", "content-type")));
        assertEquals(List.of("Content-Disposition", "Retry-After", "X-Request-Id"), configuration.getExposedHeaders());
        assertTrue(configuration.getAllowCredentials());
    }

    @Test
    void corsConfiguration_rejectsCredentialedWildcardOrigin() {
        SecurityConfig securityConfig = new SecurityConfig(mock(JwtFilter.class), new ObjectMapper());
        ReflectionTestUtils.setField(securityConfig, "corsAllowedOrigins", "*");

        assertThrows(IllegalStateException.class, securityConfig::corsConfigurationSource);
    }
}
