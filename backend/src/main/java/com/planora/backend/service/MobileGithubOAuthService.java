package com.planora.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.MobileGithubOAuthStartRequest;
import com.planora.backend.dto.MobileGithubOAuthStartResponse;
import com.planora.backend.model.Project;
import com.planora.backend.model.User;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

@Service
@RequiredArgsConstructor
@Slf4j
public class MobileGithubOAuthService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Base64.Encoder BASE64_URL = Base64.getUrlEncoder().withoutPadding();
    private static final int MAX_STARTS_PER_MINUTE = 5;

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;
    private final ProjectRepository projectRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final GitHubIntegrationService gitHubIntegrationService;

    @Value("${github.mobile.callback-uri}")
    private String callbackUri;

    @Value("${app.mobile.return-uri:planora://github-callback}")
    private String mobileReturnUri;

    @Value("${github.oauth.transaction-ttl:10m}")
    private Duration transactionTtl;

    public MobileGithubOAuthStartResponse start(
            Long userId,
            MobileGithubOAuthStartRequest request) {
        validateConfiguration();
        validateContext(userId, request);
        enforceStartRateLimit(userId);

        String state = randomUrlSafe(32);
        String verifier = randomUrlSafe(64);
        String challenge = sha256Base64(verifier);
        OAuthTransaction transaction = new OAuthTransaction(
                userId,
                request.destination(),
                request.projectId(),
                verifier,
                callbackUri,
                Instant.now().toEpochMilli());

        try {
            redis.opsForValue().set(transactionKey(state), objectMapper.writeValueAsString(transaction), transactionTtl);
        } catch (RuntimeException | JsonProcessingException ex) {
            log.error("Unable to persist GitHub OAuth transaction", ex);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "GitHub connection is temporarily unavailable");
        }

        String authorizationUrl = UriComponentsBuilder
                .fromUriString("https://github.com/login/oauth/authorize")
                .queryParam("client_id", gitHubIntegrationService.getMobileClientId())
                .queryParam("redirect_uri", callbackUri)
                .queryParam("scope", "repo user:email")
                .queryParam("state", state)
                .queryParam("code_challenge", challenge)
                .queryParam("code_challenge_method", "S256")
                .build()
                .encode()
                .toUriString();
        return new MobileGithubOAuthStartResponse(authorizationUrl, transactionTtl.toSeconds());
    }

    public String complete(String code, String state, String providerError) {
        if (state == null || state.isBlank()) {
            return resultUri("invalid_state", null);
        }

        OAuthTransaction transaction = consume(state);
        if (transaction == null) {
            return resultUri("expired_state", null);
        }

        if (providerError != null && !providerError.isBlank()) {
            return resultUri("access_denied", transaction);
        }
        if (code == null || code.isBlank()) {
            return resultUri("exchange_failed", transaction);
        }

        try {
            User user = userRepository.findById(transaction.userId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
            gitHubIntegrationService.exchangeMobileCodeAndSaveToken(
                    transaction.userId(), user.getEmail(), code,
                    transaction.callbackUri(), transaction.codeVerifier());
            return resultUri("success", transaction);
        } catch (GitHubIntegrationService.GithubAccountAlreadyLinkedException ex) {
            return resultUri("account_already_linked", transaction);
        } catch (ResponseStatusException ex) {
            String result = ex.getStatusCode() == HttpStatus.SERVICE_UNAVAILABLE
                    ? "configuration_error" : "exchange_failed";
            log.warn("GitHub mobile OAuth callback failed: status={}", ex.getStatusCode());
            return resultUri(result, transaction);
        } catch (RuntimeException ex) {
            log.error("GitHub mobile OAuth callback failed", ex);
            return resultUri("exchange_failed", transaction);
        }
    }

    private OAuthTransaction consume(String state) {
        try {
            String json = redis.opsForValue().getAndDelete(transactionKey(state));
            return json == null ? null : objectMapper.readValue(json, OAuthTransaction.class);
        } catch (RuntimeException | JsonProcessingException ex) {
            log.error("Unable to consume GitHub OAuth transaction", ex);
            return null;
        }
    }

    private void validateContext(Long userId, MobileGithubOAuthStartRequest request) {
        if (request.destination() == MobileGithubOAuthStartRequest.Destination.PROFILE) {
            if (request.projectId() != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "projectId is not allowed for PROFILE destination");
            }
            return;
        }
        if (request.projectId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "projectId is required for PROJECT destination");
        }
        Project project = projectRepository.findById(request.projectId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));
        if (teamMemberRepository.findByTeamIdAndUserUserId(project.getTeam().getId(), userId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Project membership is required");
        }
    }

    private void validateConfiguration() {
        if (!gitHubIntegrationService.isMobileOAuthConfigured()
                || callbackUri == null || callbackUri.isBlank()
                || mobileReturnUri == null || mobileReturnUri.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "GitHub mobile OAuth is not configured");
        }
    }

    private void enforceStartRateLimit(Long userId) {
        String key = "github:oauth:start:" + userId;
        try {
            Long count = redis.opsForValue().increment(key);
            if (count == null) {
                throw new IllegalStateException("Redis INCR returned null");
            }
            if (count == 1) redis.expire(key, Duration.ofMinutes(1));
            if (count > MAX_STARTS_PER_MINUTE) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                        "Too many GitHub connection attempts");
            }
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            log.error("Unable to rate limit GitHub OAuth start", ex);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "GitHub connection is temporarily unavailable");
        }
    }

    private String resultUri(String result, OAuthTransaction transaction) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(mobileReturnUri)
                .queryParam("result", result);
        if (transaction != null) {
            builder.queryParam("destination", transaction.destination().name().toLowerCase());
            if (transaction.projectId() != null) builder.queryParam("projectId", transaction.projectId());
        }
        return builder.build().encode().toUriString();
    }

    private String transactionKey(String state) {
        return "github:oauth:transaction:" + sha256Base64(state);
    }

    private static String randomUrlSafe(int byteCount) {
        byte[] bytes = new byte[byteCount];
        RANDOM.nextBytes(bytes);
        return BASE64_URL.encodeToString(bytes);
    }

    private static String sha256Base64(String value) {
        try {
            return BASE64_URL.encodeToString(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.US_ASCII)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }

    private record OAuthTransaction(
            Long userId,
            MobileGithubOAuthStartRequest.Destination destination,
            Long projectId,
            String codeVerifier,
            String callbackUri,
            long createdAtEpochMs) {}
}
