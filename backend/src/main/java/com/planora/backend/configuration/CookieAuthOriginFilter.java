package com.planora.backend.configuration;

import java.io.IOException;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/** Origin check for endpoints authenticated by the refresh-token cookie. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 25)
public class CookieAuthOriginFilter extends OncePerRequestFilter {

    private final Set<String> allowedOrigins;

    public CookieAuthOriginFilter(
            @Value("${cors.allowed-origins:http://localhost:3000}") String configuredOrigins) {
        this.allowedOrigins = Arrays.stream(configuredOrigins.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .collect(Collectors.toUnmodifiableSet());
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String path = request.getRequestURI();
        return !("/api/auth/refresh".equals(path) || "/api/auth/logout".equals(path));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String origin = request.getHeader("Origin");
        String fetchSite = request.getHeader("Sec-Fetch-Site");
        // Fetch Metadata is browser-only. If it is present, Origin must also be
        // present and allowlisted; native clients do not send either header.
        if (fetchSite != null && !fetchSite.isBlank() && (origin == null || origin.isBlank())) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Browser cookie request is missing Origin");
            return;
        }
        // Native clients do not send Origin. Browser requests do, so reject an
        // explicitly cross-site origin before reading the authentication cookie.
        if (origin != null && !allowedOrigins.contains(origin)) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Untrusted request origin");
            return;
        }
        if (fetchSite != null && !fetchSite.isBlank()
                && !"same-origin".equalsIgnoreCase(fetchSite)
                && !"same-site".equalsIgnoreCase(fetchSite)
                && !"none".equalsIgnoreCase(fetchSite)) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Cross-site cookie request rejected");
            return;
        }
        filterChain.doFilter(request, response);
    }
}
