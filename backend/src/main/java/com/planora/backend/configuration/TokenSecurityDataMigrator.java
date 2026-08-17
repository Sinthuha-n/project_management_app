package com.planora.backend.configuration;

import com.planora.backend.model.GithubIntegration;
import com.planora.backend.model.User;
import com.planora.backend.repository.GithubIntegrationRepository;
import com.planora.backend.repository.UserRepository;
import com.planora.backend.util.TokenEncryptionUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Automatically scans database tables on startup and encrypts any legacy plaintext
 * tokens using AES-256-GCM without dropping data or requiring user re-authentication.
 */
@Slf4j
@Component
@Order(100)
@RequiredArgsConstructor
public class TokenSecurityDataMigrator implements ApplicationRunner {

    private final UserRepository userRepository;
    private final GithubIntegrationRepository githubIntegrationRepository;

    @Value("${github.sync.enabled:true}")
    private boolean githubSyncEnabled;

    @Value("${github.token.encryption.key:}")
    private String encryptionKey;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!githubSyncEnabled || encryptionKey == null || encryptionKey.isBlank()) {
            log.info("[TokenMigration] GitHub sync disabled or encryption key missing, skipping automatic token migration");
            return;
        }

        int migratedUsers = migrateUserTokens();
        int migratedIntegrations = migrateIntegrationTokens();

        if (migratedUsers > 0 || migratedIntegrations > 0) {
            log.info("[TokenMigration] Successfully encrypted {} user token(s) and {} integration token(s) at rest",
                    migratedUsers, migratedIntegrations);
        } else {
            log.info("[TokenMigration] All stored tokens are already encrypted at rest");
        }
    }

    public int migrateUserTokens() {
        if (encryptionKey == null || encryptionKey.isBlank()) {
            return 0;
        }
        List<User> usersWithTokens = userRepository.findByGithubAccessTokenIsNotNull();
        int migrated = 0;

        for (User user : usersWithTokens) {
            String token = user.getGithubAccessToken();
            if (token != null && !token.isBlank() && !TokenEncryptionUtil.isEncrypted(token, encryptionKey)) {
                try {
                    String encrypted = TokenEncryptionUtil.encrypt(token, encryptionKey);
                    user.setGithubAccessToken(encrypted);
                    userRepository.save(user);
                    migrated++;
                    log.info("[TokenMigration] Encrypted plaintext GitHub token for user id={}", user.getUserId());
                } catch (Exception e) {
                    log.error("[TokenMigration] Failed to encrypt GitHub token for user id={}: {}", user.getUserId(), e.getMessage());
                }
            }
        }
        return migrated;
    }

    public int migrateIntegrationTokens() {
        if (encryptionKey == null || encryptionKey.isBlank()) {
            return 0;
        }
        List<GithubIntegration> integrations = githubIntegrationRepository.findByEncryptedAccessTokenIsNotNull();
        int migrated = 0;

        for (GithubIntegration integration : integrations) {
            String token = integration.getEncryptedAccessToken();
            if (token != null && !token.isBlank() && !TokenEncryptionUtil.isEncrypted(token, encryptionKey)) {
                try {
                    String encrypted = TokenEncryptionUtil.encrypt(token, encryptionKey);
                    integration.setEncryptedAccessToken(encrypted);
                    githubIntegrationRepository.save(integration);
                    migrated++;
                    log.info("[TokenMigration] Encrypted plaintext token for integration id={}", integration.getId());
                } catch (Exception e) {
                    log.error("[TokenMigration] Failed to encrypt token for integration id={}: {}", integration.getId(), e.getMessage());
                }
            }
        }
        return migrated;
    }
}
