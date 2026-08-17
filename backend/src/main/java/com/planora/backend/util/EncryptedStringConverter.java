package com.planora.backend.util;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * JPA AttributeConverter that automatically encrypts sensitive string attributes with AES-256-GCM
 * before writing to the database, and automatically decrypts them when reading.
 *
 * If a legacy unencrypted value is encountered in the database, it transparently returns the plaintext
 * without throwing an exception, and when the entity is subsequently saved, it will be saved encrypted.
 */
@Slf4j
@Component
@Converter(autoApply = false)
public class EncryptedStringConverter implements AttributeConverter<String, String> {

    private static String staticEncryptionKey;

    @Value("${github.token.encryption.key:}")
    public void setStaticEncryptionKey(String key) {
        EncryptedStringConverter.staticEncryptionKey = key;
    }

    public static void setStaticKey(String key) {
        EncryptedStringConverter.staticEncryptionKey = key;
    }

    private String getKey() {
        if (staticEncryptionKey != null && !staticEncryptionKey.isBlank()) {
            return staticEncryptionKey;
        }
        String envKey = System.getenv("GITHUB_TOKEN_ENCRYPTION_KEY");
        if (envKey != null && !envKey.isBlank()) {
            return envKey;
        }
        String propKey = System.getProperty("github.token.encryption.key");
        if (propKey != null && !propKey.isBlank()) {
            return propKey;
        }
        return null;
    }

    @Override
    public String convertToDatabaseColumn(String attribute) {
        if (attribute == null || attribute.isBlank()) {
            return attribute;
        }
        String key = getKey();
        if (key == null || key.isBlank()) {
            log.warn("Encryption key is not set; persisting sensitive attribute without encryption");
            return attribute;
        }
        // If already encrypted with valid key, don't double-encrypt
        if (TokenEncryptionUtil.isEncrypted(attribute, key)) {
            return attribute;
        }
        try {
            return TokenEncryptionUtil.encrypt(attribute, key);
        } catch (Exception e) {
            log.error("Failed to encrypt attribute for database column: {}", e.getMessage());
            throw new IllegalStateException("Failed to encrypt sensitive data", e);
        }
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return dbData;
        }
        String key = getKey();
        if (key == null || key.isBlank()) {
            return dbData;
        }
        // Transparent fallback: if it's ciphertext, decrypt; if legacy plaintext, return as-is
        return TokenEncryptionUtil.decryptOrPassthrough(dbData, key);
    }
}
