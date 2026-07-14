package com.planora.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.MobileGithubOAuthStartRequest;
import com.planora.backend.dto.MobileGithubOAuthStartResponse;
import com.planora.backend.model.User;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.repository.UserRepository;
import com.planora.backend.service.JWTService;
import com.planora.backend.service.MobileGithubOAuthService;
import com.planora.backend.service.GithubTokenService;
import com.planora.backend.configuration.JwtFilter;
import com.planora.backend.configuration.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MobileGithubOAuthController.class)
@Import(SecurityConfig.class)
class MobileGithubOAuthControllerTest {
    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockitoBean MobileGithubOAuthService oauthService;
    @MockitoBean UserRepository userRepository;
    @MockitoBean JWTService jwtService;
    @MockitoBean UserDetailsService userDetailsService;
    @MockitoBean JwtFilter jwtFilter;
    @MockitoBean GithubTokenService githubTokenService;

    @BeforeEach
    void allowRequestsThroughJwtFilter() throws Exception {
        doAnswer(invocation -> {
            jakarta.servlet.ServletRequest request = invocation.getArgument(0);
            jakarta.servlet.ServletResponse response = invocation.getArgument(1);
            jakarta.servlet.FilterChain chain = invocation.getArgument(2);
            chain.doFilter(request, response);
            return null;
        }).when(jwtFilter).doFilter(any(), any(), any());
    }

    @Test
    void authenticatedUserCanStartProfileFlow() throws Exception {
        User userEntity = new User();
        userEntity.setUserId(7L);
        userEntity.setEmail("user@example.com");
        UserPrincipal principal = new UserPrincipal(userEntity);
        var request = new MobileGithubOAuthStartRequest(MobileGithubOAuthStartRequest.Destination.PROFILE, null);
        when(oauthService.start(eq(7L), eq(request)))
                .thenReturn(new MobileGithubOAuthStartResponse("https://github.com/login/oauth/authorize", 600));

        mockMvc.perform(post("/api/github/mobile/oauth/start")
                        .with(user(principal))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.expiresInSeconds").value(600));
    }

    @Test
    void callbackIsPublicAndRedirectsWithoutLeakingCode() throws Exception {
        when(oauthService.complete("secret-code", "opaque-state", null))
                .thenReturn("planora://github-callback?result=success&destination=profile");

        mockMvc.perform(get("/api/github/mobile/oauth/callback")
                        .param("code", "secret-code")
                        .param("state", "opaque-state"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location",
                        "planora://github-callback?result=success&destination=profile"))
                .andExpect(header().string("Cache-Control", "no-store"));
    }
}
