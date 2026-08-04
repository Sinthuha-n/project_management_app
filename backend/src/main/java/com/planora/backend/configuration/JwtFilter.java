package com.planora.backend.configuration;

import com.planora.backend.service.JWTService;
import com.planora.backend.dto.ApiErrorResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.MalformedJwtException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.core.userdetails.UserDetailsService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtFilter extends OncePerRequestFilter {

    private final JWTService jwtService;
    private final UserDetailsService userDetailsService;
    private final ObjectMapper objectMapper;
    private static final Logger logger = LoggerFactory.getLogger(JwtFilter.class);
    private static final AntPathMatcher PATH_MATCHER = new AntPathMatcher();
    // Single source of truth — see PublicEndpoints for the canonical list.

    public JwtFilter(JWTService jwtService, UserDetailsService userDetailsService, ObjectMapper objectMapper) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String path = request.getServletPath();
        if (path == null || path.isBlank()) {
            path = request.getRequestURI();
        }
        String requestPath = path;
        return PublicEndpoints.PATTERNS.stream().anyMatch(pattern -> PATH_MATCHER.match(pattern, requestPath));
    }


    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        String email = null;
        String token = null;

        try{
        if(authHeader != null && authHeader.startsWith("Bearer ")){
            token = authHeader.substring(7);
            email = jwtService.extractEmail(token);
        }

        if (email != null && SecurityContextHolder.getContext().getAuthentication() == null){

            UserDetails userDetails = userDetailsService.loadUserByUsername(email);

            if(jwtService.validateToken(token,userDetails)){
                // Only a valid access token for this user may reveal that the account
                // needs verification. A signed token of another type remains anonymous.
                if (!userDetails.isEnabled()) {
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType("application/json");
                    ApiErrorResponse errorResponse = new ApiErrorResponse(
                        java.time.LocalDateTime.now().toString(),
                        HttpServletResponse.SC_FORBIDDEN,
                        "EMAIL_NOT_VERIFIED",
                        "Email not verified",
                        request.getRequestURI(),
                        null
                    );
                    response.getWriter().write(objectMapper.writeValueAsString(errorResponse));
                    return;
                }

                UsernamePasswordAuthenticationToken authenticationToken = new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());

                authenticationToken.setDetails(
                        new WebAuthenticationDetailsSource()
                                .buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authenticationToken);
            }
        }


        filterChain.doFilter(request, response);
        } catch (UsernameNotFoundException e) {
            logger.info("JWT references a user that no longer exists");
            sendErrorResponse(request, response, "User not found");
        } catch (ExpiredJwtException e) {
            logger.debug("JWT expired for request: {}", request.getRequestURI());
            sendErrorResponse(request, response, "Token has expired");
        } catch (MalformedJwtException e) {
            logger.debug("Malformed JWT on request: {}", request.getRequestURI());
            sendErrorResponse(request, response, "Invalid token format");
        } catch (JwtException | IllegalArgumentException e) {
            logger.debug("JWT validation failed for request: {}", request.getRequestURI());
            sendErrorResponse(request, response, "Invalid or expired token");
        }

    }

    private void sendErrorResponse(HttpServletRequest request, HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setHeader("WWW-Authenticate", "Bearer realm=\"planora\"");
        response.setContentType("application/json");
        ApiErrorResponse errorResponse = new ApiErrorResponse(
            java.time.LocalDateTime.now().toString(),
            HttpServletResponse.SC_UNAUTHORIZED,
            "UNAUTHORIZED",
            message,
            request.getRequestURI(),
            null
        );
        response.getWriter().write(objectMapper.writeValueAsString(errorResponse));
    }
}
