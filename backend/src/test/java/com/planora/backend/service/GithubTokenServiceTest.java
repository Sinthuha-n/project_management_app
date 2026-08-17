package com.planora.backend.service;

import static com.planora.backend.support.TestDataFactory.user;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import com.planora.backend.exception.GithubIntegrationDisabledException;
import com.planora.backend.model.GithubIntegration;
import com.planora.backend.model.User;
import com.planora.backend.repository.UserRepository;
import com.planora.backend.util.TokenEncryptionUtil;

@ExtendWith(MockitoExtension.class)
class GithubTokenServiceTest {

    @Mock UserRepository userRepository;
    private GithubTokenService service;
    private String key;

    @BeforeEach
    void setUp() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        key = Base64.getEncoder().encodeToString(bytes);
        service = new GithubTokenService();
        ReflectionTestUtils.setField(service, "userRepository", userRepository);
        ReflectionTestUtils.setField(service, "githubSyncEnabled", true);
        ReflectionTestUtils.setField(service, "encryptionKey", key);
        ReflectionTestUtils.setField(service, "defaultToken", "default-token");
    }

    @Test
    void validationRejectsDisabledMissingMalformedAndWrongLengthKeys() {
        ReflectionTestUtils.setField(service, "githubSyncEnabled", false);
        assertThatThrownBy(service::validateGithubIntegration).isInstanceOf(GithubIntegrationDisabledException.class);
        ReflectionTestUtils.setField(service, "githubSyncEnabled", true);
        ReflectionTestUtils.setField(service, "encryptionKey", " ");
        assertThatThrownBy(service::validateGithubIntegration).isInstanceOf(GithubIntegrationDisabledException.class);
        ReflectionTestUtils.setField(service, "encryptionKey", "not-base64");
        assertThatThrownBy(service::validateGithubIntegration).isInstanceOf(GithubIntegrationDisabledException.class);
        ReflectionTestUtils.setField(service, "encryptionKey", Base64.getEncoder().encodeToString(new byte[16]));
        assertThatThrownBy(service::validateGithubIntegration).isInstanceOf(GithubIntegrationDisabledException.class);
        ReflectionTestUtils.setField(service, "encryptionKey", key);
        service.validateGithubIntegration();

        String urlEncodedKey = Base64.getUrlEncoder().withoutPadding().encodeToString(
                new byte[] {-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
                        -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1});
        ReflectionTestUtils.setField(service, "encryptionKey", urlEncodedKey);
        service.validateGithubIntegration();
    }

    @Test
    void encryptionRoundTripsAndRejectsCorruptCiphertext() {
        String encrypted = service.encryptToken("github-secret");
        assertThat(encrypted).isNotEqualTo("github-secret");
        assertThat(service.decryptToken(encrypted)).isEqualTo("github-secret");
        assertThatThrownBy(() -> service.decryptToken("corrupt"))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("decrypt");
    }

    @Test
    void resolveUsesIntegrationTokenThenDefaultAndReportsMissingToken() {
        GithubIntegration integration = new GithubIntegration();
        integration.setId(9L);
        integration.setEncryptedAccessToken(service.encryptToken("integration-token"));
        assertThat(service.resolveToken(integration)).isEqualTo("integration-token");

        integration.setEncryptedAccessToken(" ");
        assertThat(service.resolveToken(integration)).isEqualTo("default-token");
        assertThat(service.hasValidToken(integration)).isTrue();

        ReflectionTestUtils.setField(service, "defaultToken", "");
        assertThatThrownBy(() -> service.resolveToken(integration)).isInstanceOf(IllegalStateException.class);
        assertThat(service.hasValidToken(integration)).isFalse();

        ReflectionTestUtils.setField(service, "defaultToken", "fallback");
        assertThat(service.resolveToken(null)).isEqualTo("fallback");
        ReflectionTestUtils.setField(service, "defaultToken", null);
        assertThatThrownBy(() -> service.resolveToken(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("id=null");
    }

    @Test
    void saveGetAndClearManageEncryptedUserToken() {
        User user = user(1, "octocat");
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        service.saveToken(1L, "secret-token");
        assertThat(user.getGithubAccessToken()).isNotBlank().isNotEqualTo("secret-token");
        assertThat(service.getToken(1L)).isEqualTo("secret-token");
        verify(userRepository).save(user);

        service.clearToken(1L);
        assertThat(user.getGithubAccessToken()).isNull();
        assertThat(service.getToken(1L)).isNull();
    }

    @Test
    void userOperationsRejectUnknownUsersAndCorruptStoredTokens() {
        when(userRepository.findById(404L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.saveToken(404L, "token")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.getToken(404L)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.clearToken(404L)).isInstanceOf(IllegalArgumentException.class);

        User user = user(1, "octocat");
        user.setGithubAccessToken("corrupt");
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        assertThatThrownBy(() -> service.getToken(1L)).isInstanceOf(IllegalStateException.class);

        assertThatThrownBy(() -> service.saveToken(1L, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("encrypt GitHub token for user");
    }

    @Test
    void legacyPlaintextToken_resolvesAndAutoEncrypts() {
        User user = user(1, "octocat");
        user.setGithubAccessToken("ghp_legacy_personal_access_token");
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        String retrieved = service.getToken(1L);
        assertThat(retrieved).isEqualTo("ghp_legacy_personal_access_token");
        assertThat(TokenEncryptionUtil.isEncrypted(user.getGithubAccessToken(), key)).isTrue();
        verify(userRepository).save(user);

        GithubIntegration integration = new GithubIntegration();
        integration.setId(12L);
        integration.setEncryptedAccessToken("ghp_legacy_integration_token");

        String resolved = service.resolveToken(integration);
        assertThat(resolved).isEqualTo("ghp_legacy_integration_token");
        assertThat(TokenEncryptionUtil.isEncrypted(integration.getEncryptedAccessToken(), key)).isTrue();
    }
}
