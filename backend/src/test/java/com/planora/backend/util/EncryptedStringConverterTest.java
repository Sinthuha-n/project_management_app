package com.planora.backend.util;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.security.SecureRandom;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class EncryptedStringConverterTest {

    private EncryptedStringConverter converter;
    private String key;

    @BeforeEach
    void setUp() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        key = Base64.getEncoder().encodeToString(bytes);

        converter = new EncryptedStringConverter();
        converter.setStaticEncryptionKey(key);
    }

    @Test
    void convertToDatabaseColumn_encryptsPlaintext() {
        String plaintext = "ghp_secure_github_token";
        String dbColumn = converter.convertToDatabaseColumn(plaintext);

        assertNotNull(dbColumn);
        assertNotEquals(plaintext, dbColumn);
        assertTrue(TokenEncryptionUtil.isEncrypted(dbColumn, key));
    }

    @Test
    void convertToDatabaseColumn_doesNotDoubleEncryptAlreadyEncrypted() throws Exception {
        String plaintext = "ghp_secure_github_token";
        String encrypted = TokenEncryptionUtil.encrypt(plaintext, key);

        String dbColumn = converter.convertToDatabaseColumn(encrypted);
        assertEquals(encrypted, dbColumn);
    }

    @Test
    void convertToEntityAttribute_decryptsCiphertext() throws Exception {
        String plaintext = "ghp_secure_github_token";
        String encrypted = TokenEncryptionUtil.encrypt(plaintext, key);

        String entityAttribute = converter.convertToEntityAttribute(encrypted);
        assertEquals(plaintext, entityAttribute);
    }

    @Test
    void convertToEntityAttribute_passesThroughLegacyPlaintext() {
        String legacyPlaintext = "ghp_legacy_plaintext_token";
        String entityAttribute = converter.convertToEntityAttribute(legacyPlaintext);
        assertEquals(legacyPlaintext, entityAttribute);
    }

    @Test
    void nullAndBlankHandling() {
        assertNull(converter.convertToDatabaseColumn(null));
        assertEquals("", converter.convertToDatabaseColumn(""));
        assertNull(converter.convertToEntityAttribute(null));
        assertEquals("", converter.convertToEntityAttribute(""));
    }
}
