package com.planora.backend.service;

import com.planora.backend.model.GithubIntegration;
import com.planora.backend.model.User;
import com.planora.backend.repository.UserRepository;
import com.planora.backend.util.TokenEncryptionUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Slf4j
@Service
public class GithubTokenService {

    @Autowired
    private UserRepository userRepository;

    @Value("${github.default.token:}")
    private String defaultToken;

    @Value("${github.token.encryption.key:}")
    private String encryptionKey;

    @Value("${github.sync.enabled:true}")
    private boolean githubSyncEnabled;

    public void validateGithubIntegration() {
        if (!githubSyncEnabled) {
            throw new com.planora.backend.exception.GithubIntegrationDisabledException("GitHub integration is disabled");
        }
        if (encryptionKey == null || encryptionKey.isBlank()) {
            throw new com.planora.backend.exception.GithubIntegrationDisabledException("GitHub integration is disabled: encryption key is missing");
        }
        byte[] decoded;
        try {
            decoded = java.util.Base64.getDecoder().decode(encryptionKey.getBytes());
        } catch (IllegalArgumentException e) {
            try {
                decoded = java.util.Base64.getUrlDecoder().decode(encryptionKey.getBytes());
            } catch (IllegalArgumentException ex) {
                throw new com.planora.backend.exception.GithubIntegrationDisabledException("GitHub integration is disabled: encryption key is not valid Base64");
            }
        }
        if (decoded.length != 32) {
            throw new com.planora.backend.exception.GithubIntegrationDisabledException("GitHub integration is disabled: encryption key must decode to exactly 32 bytes");
        }
    }

    public String resolveToken(GithubIntegration integration) {
        validateGithubIntegration();
        if (integration != null && StringUtils.hasText(integration.getEncryptedAccessToken())) {
            String stored = integration.getEncryptedAccessToken();
            if (TokenEncryptionUtil.isEncrypted(stored, encryptionKey)) {
                return decryptToken(stored);
            }
            if (stored.startsWith("ghp_") || stored.startsWith("gho_") || stored.startsWith("github_pat_")) {
                log.warn("Found unencrypted token on GitHub integration id={}, auto-encrypting", integration.getId());
                try {
                    integration.setEncryptedAccessToken(encryptToken(stored));
                } catch (Exception ignored) {}
                return stored;
            }
            return decryptToken(stored);
        }
        if (StringUtils.hasText(defaultToken)) {
            return defaultToken;
        }
        throw new IllegalStateException("No GitHub token configured for integration id="
            + (integration != null ? integration.getId() : "null"));
    }

    public boolean hasValidToken(GithubIntegration integration) {
        try {
            resolveToken(integration);
            return true;
        } catch (IllegalStateException e) {
            return false;
        }
    }

    @Transactional
    public void saveToken(Long userId, String token) {
        validateGithubIntegration();
        if (!StringUtils.hasText(encryptionKey)) {
            throw new IllegalStateException("GITHUB_TOKEN_ENCRYPTION_KEY is not configured");
        }
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        try {
            String encrypted = encryptToken(token);
            user.setGithubAccessToken(encrypted);
            userRepository.save(user);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to encrypt GitHub token for user " + userId, e);
        }
    }

    @Transactional
    public String getToken(Long userId) {
        validateGithubIntegration();
        if (!StringUtils.hasText(encryptionKey)) {
            throw new IllegalStateException("GITHUB_TOKEN_ENCRYPTION_KEY is not configured");
        }
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        String stored = user.getGithubAccessToken();
        if (!StringUtils.hasText(stored)) {
            return null;
        }
        if (TokenEncryptionUtil.isEncrypted(stored, encryptionKey)) {
            return decryptToken(stored);
        }
        try {
            return decryptToken(stored);
        } catch (Exception e) {
            if (stored.startsWith("ghp_") || stored.startsWith("gho_") || stored.startsWith("github_pat_")) {
                log.warn("Found unencrypted legacy GitHub token for user {}, re-encrypting", userId);
                try {
                    user.setGithubAccessToken(encryptToken(stored));
                    userRepository.save(user);
                } catch (Exception ignored) {}
                return stored;
            }
            throw new IllegalStateException("Failed to decrypt GitHub token for user " + userId, e);
        }
    }

    @Transactional
    public void clearToken(Long userId) {
        validateGithubIntegration();
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        user.setGithubAccessToken(null);
        userRepository.save(user);
    }

    public String encryptToken(String token) {
        validateGithubIntegration();
        if (!StringUtils.hasText(encryptionKey)) {
            throw new IllegalStateException("GITHUB_TOKEN_ENCRYPTION_KEY is not configured");
        }
        try {
            return TokenEncryptionUtil.encrypt(token, encryptionKey);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to encrypt GitHub token", e);
        }
    }

    public String decryptToken(String encryptedToken) {
        validateGithubIntegration();
        if (!StringUtils.hasText(encryptionKey)) {
            throw new IllegalStateException("GITHUB_TOKEN_ENCRYPTION_KEY is not configured");
        }
        try {
            return TokenEncryptionUtil.decrypt(encryptedToken, encryptionKey);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to decrypt GitHub token", e);
        }
    }
}
