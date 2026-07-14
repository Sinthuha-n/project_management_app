package com.planora.backend.configuration;

import com.planora.backend.service.JWTService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;

import java.util.Collections;
import com.fasterxml.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JwtFilterTest {

    @Mock
    private JWTService jwtService;

    @Mock
    private UserDetailsService userDetailsService;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private JwtFilter jwtFilter;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldNotFilter_returnsTrueForOptionsMethod() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("OPTIONS", "/api/tasks");
        assertTrue(jwtFilter.shouldNotFilter(request));
    }

    @Test
    void shouldNotFilter_returnsTrueForPublicLoginEndpoint() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setServletPath("/api/auth/login");
        assertTrue(jwtFilter.shouldNotFilter(request));
    }

    @Test
    void shouldNotFilter_returnsFalseForProtectedEndpoint() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/tasks/1");
        request.setServletPath("/api/tasks/1");
        assertFalse(jwtFilter.shouldNotFilter(request));
    }

    @Test
    void doFilterInternal_setsAuthentication_whenValidToken() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/tasks");
        request.addHeader("Authorization", "Bearer valid-token");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        UserDetails userDetails = User.withUsername("alice@example.com")
                .password("ValidPassword123!").authorities(Collections.emptyList()).build();

        when(jwtService.extractEmail("valid-token")).thenReturn("alice@example.com");
        when(userDetailsService.loadUserByUsername("alice@example.com")).thenReturn(userDetails);
        when(jwtService.validateToken("valid-token", userDetails)).thenReturn(true);

        jwtFilter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
        assertEquals("alice@example.com", SecurityContextHolder.getContext().getAuthentication().getName());
    }

    @Test
    void doFilterInternal_returnsEmailNotVerified_onlyAfterAccessTokenValidation() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/tasks");
        request.addHeader("Authorization", "Bearer valid-unverified-token");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        UserDetails userDetails = User.withUsername("alice@example.com")
                .password("ValidPassword123!")
                .disabled(true)
                .authorities(Collections.emptyList())
                .build();

        when(jwtService.extractEmail("valid-unverified-token")).thenReturn("alice@example.com");
        when(userDetailsService.loadUserByUsername("alice@example.com")).thenReturn(userDetails);
        when(jwtService.validateToken("valid-unverified-token", userDetails)).thenReturn(true);

        jwtFilter.doFilterInternal(request, response, chain);

        assertEquals(HttpServletResponse.SC_FORBIDDEN, response.getStatus());
        assertTrue(response.getContentAsString().contains("\"errorCode\":\"EMAIL_NOT_VERIFIED\""));
        verify(jwtService).validateToken("valid-unverified-token", userDetails);
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    void doFilterInternal_doesNotRevealVerificationState_forInvalidAccessToken() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/tasks");
        request.addHeader("Authorization", "Bearer wrong-token-type");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        UserDetails userDetails = User.withUsername("alice@example.com")
                .password("ValidPassword123!")
                .disabled(true)
                .authorities(Collections.emptyList())
                .build();

        when(jwtService.extractEmail("wrong-token-type")).thenReturn("alice@example.com");
        when(userDetailsService.loadUserByUsername("alice@example.com")).thenReturn(userDetails);
        when(jwtService.validateToken("wrong-token-type", userDetails)).thenReturn(false);

        jwtFilter.doFilterInternal(request, response, chain);

        assertFalse(response.getContentAsString().contains("EMAIL_NOT_VERIFIED"));
        verify(chain).doFilter(request, response);
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void doFilterInternal_returns401_whenTokenExpired() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/tasks");
        request.addHeader("Authorization", "Bearer expired-token");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        when(jwtService.extractEmail("expired-token"))
                .thenThrow(new io.jsonwebtoken.ExpiredJwtException(null, null, "Expired"));

        jwtFilter.doFilterInternal(request, response, chain);

        assertEquals(HttpServletResponse.SC_UNAUTHORIZED, response.getStatus());
        String content = response.getContentAsString();
        assertTrue(content.contains("\"status\":401"));
        assertTrue(content.contains("\"errorCode\":\"UNAUTHORIZED\""));
        assertTrue(content.contains("\"message\":\"Token has expired\""));
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    void doFilterInternal_returns401_whenMalformedToken() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/tasks");
        request.addHeader("Authorization", "Bearer bad.token");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        when(jwtService.extractEmail("bad.token"))
                .thenThrow(new io.jsonwebtoken.MalformedJwtException("Malformed"));

        jwtFilter.doFilterInternal(request, response, chain);

        assertEquals(HttpServletResponse.SC_UNAUTHORIZED, response.getStatus());
        String content = response.getContentAsString();
        assertTrue(content.contains("\"status\":401"));
        assertTrue(content.contains("\"errorCode\":\"UNAUTHORIZED\""));
        assertTrue(content.contains("\"message\":\"Invalid token format\""));
    }

    @Test
    void doFilterInternal_continuesChain_whenNoAuthorizationHeader() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/tasks");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        jwtFilter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }
}
