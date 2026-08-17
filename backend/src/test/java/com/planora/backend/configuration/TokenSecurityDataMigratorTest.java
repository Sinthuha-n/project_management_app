package com.planora.backend.configuration;

import com.planora.backend.model.GithubIntegration;
import com.planora.backend.model.User;
import com.planora.backend.repository.GithubIntegrationRepository;
import com.planora.backend.repository.UserRepository;
import com.planora.backend.util.TokenEncryptionUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TokenSecurityDataMigratorTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private GithubIntegrationRepository githubIntegrationRepository;

    private TokenSecurityDataMigrator migrator;
    private String key;

    @BeforeEach
    void setUp() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        key = Base64.getEncoder().encodeToString(bytes);

        migrator = new TokenSecurityDataMigrator(userRepository, githubIntegrationRepository);
        ReflectionTestUtils.setField(migrator, "githubSyncEnabled", true);
        ReflectionTestUtils.setField(migrator, "encryptionKey", key);
    }

    @Test
    void run_migratesPlaintextTokensSuccessfully() {
        User user1 = new User();
        user1.setUserId(1L);
        user1.setGithubAccessToken("ghp_legacy_user_token");

        GithubIntegration integration1 = new GithubIntegration();
        integration1.setId(10L);
        integration1.setEncryptedAccessToken("ghp_legacy_integration_token");

        when(userRepository.findByGithubAccessTokenIsNotNull()).thenReturn(List.of(user1));
        when(githubIntegrationRepository.findByEncryptedAccessTokenIsNotNull()).thenReturn(List.of(integration1));

        migrator.run(null);

        verify(userRepository, times(1)).save(user1);
        verify(githubIntegrationRepository, times(1)).save(integration1);

        assertTrue(TokenEncryptionUtil.isEncrypted(user1.getGithubAccessToken(), key));
        assertTrue(TokenEncryptionUtil.isEncrypted(integration1.getEncryptedAccessToken(), key));
    }

    @Test
    void run_skipsAlreadyEncryptedTokens() throws Exception {
        String encryptedUserToken = TokenEncryptionUtil.encrypt("ghp_secret_user", key);
        String encryptedIntToken = TokenEncryptionUtil.encrypt("ghp_secret_int", key);

        User user = new User();
        user.setUserId(1L);
        user.setGithubAccessToken(encryptedUserToken);

        GithubIntegration integration = new GithubIntegration();
        integration.setId(10L);
        integration.setEncryptedAccessToken(encryptedIntToken);

        when(userRepository.findByGithubAccessTokenIsNotNull()).thenReturn(List.of(user));
        when(githubIntegrationRepository.findByEncryptedAccessTokenIsNotNull()).thenReturn(List.of(integration));

        migrator.run(null);

        verify(userRepository, never()).save(any());
        verify(githubIntegrationRepository, never()).save(any());
    }

    @Test
    void run_skipsWhenDisabledOrKeyMissing() {
        ReflectionTestUtils.setField(migrator, "githubSyncEnabled", false);
        migrator.run(null);

        verify(userRepository, never()).findByGithubAccessTokenIsNotNull();
        verify(githubIntegrationRepository, never()).findByEncryptedAccessTokenIsNotNull();

        ReflectionTestUtils.setField(migrator, "githubSyncEnabled", true);
        ReflectionTestUtils.setField(migrator, "encryptionKey", "");
        migrator.run(null);

        verify(userRepository, never()).findByGithubAccessTokenIsNotNull();
        verify(githubIntegrationRepository, never()).findByEncryptedAccessTokenIsNotNull();
    }
}
