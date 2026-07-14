package com.planora.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.MobileGithubOAuthStartRequest;
import com.planora.backend.model.User;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MobileGithubOAuthServiceTest {
    private StringRedisTemplate redis;
    private ValueOperations<String, String> values;
    private UserRepository userRepository;
    private GitHubIntegrationService integrationService;
    private MobileGithubOAuthService service;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void setUp() {
        redis = mock(StringRedisTemplate.class);
        values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        userRepository = mock(UserRepository.class);
        integrationService = mock(GitHubIntegrationService.class);
        when(integrationService.isMobileOAuthConfigured()).thenReturn(true);
        when(integrationService.getMobileClientId()).thenReturn("mobile-client");

        service = new MobileGithubOAuthService(
                redis,
                new ObjectMapper().findAndRegisterModules(),
                mock(ProjectRepository.class),
                mock(TeamMemberRepository.class),
                userRepository,
                integrationService);
        ReflectionTestUtils.setField(service, "callbackUri", "https://api.planora.app/api/github/mobile/oauth/callback");
        ReflectionTestUtils.setField(service, "mobileReturnUri", "planora://github-callback");
        ReflectionTestUtils.setField(service, "transactionTtl", Duration.ofMinutes(10));
    }

    @Test
    void startCreatesOpaquePkceAuthorizationRequest() {
        when(values.increment("github:oauth:start:7")).thenReturn(1L);

        var response = service.start(7L,
                new MobileGithubOAuthStartRequest(MobileGithubOAuthStartRequest.Destination.PROFILE, null));

        assertEquals(600, response.expiresInSeconds());
        assertTrue(response.authorizationUrl().contains("client_id=mobile-client"));
        assertTrue(response.authorizationUrl().contains("code_challenge_method=S256"));
        assertTrue(response.authorizationUrl().contains("state="));
        assertFalse(response.authorizationUrl().contains("code_verifier"));
        verify(values).set(anyString(), anyString(), eq(Duration.ofMinutes(10)));
    }

    @Test
    void completeConsumesTransactionAndReturnsOnlySafeMetadata() {
        String transaction = """
                {"userId":7,"destination":"PROJECT","projectId":12,
                 "codeVerifier":"verifier","callbackUri":"https://api.planora.app/api/github/mobile/oauth/callback",
                 "createdAtEpochMs":1}
                """;
        when(values.getAndDelete(anyString())).thenReturn(transaction);
        User user = new User();
        user.setUserId(7L);
        user.setEmail("user@example.com");
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));

        String result = service.complete("github-code", "opaque-state", null);

        assertEquals("planora://github-callback?result=success&destination=project&projectId=12", result);
        assertFalse(result.contains("github-code"));
        verify(integrationService).exchangeMobileCodeAndSaveToken(
                7L, "user@example.com", "github-code",
                "https://api.planora.app/api/github/mobile/oauth/callback", "verifier");
    }

    @Test
    void missingOrConsumedStateCannotComplete() {
        when(values.getAndDelete(anyString())).thenReturn(null);
        assertEquals("planora://github-callback?result=expired_state",
                service.complete("code", "already-used", null));
    }
}
