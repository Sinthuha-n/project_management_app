package com.planora.backend.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.security.SecureRandom;
import java.util.Base64;

import org.junit.jupiter.api.Test;

class TokenEncryptionUtilTest {

    private static String key(int bytes) {
        byte[] value = new byte[bytes];
        new SecureRandom().nextBytes(value);
        return Base64.getEncoder().encodeToString(value);
    }

    @Test
    void encryptAndDecrypt_roundTripsUtf8Content() throws Exception {
        String encryptionKey = key(32);
        String plaintext = "GitHub token 🔐 with unicode";

        assertEquals(plaintext,
                TokenEncryptionUtil.decrypt(TokenEncryptionUtil.encrypt(plaintext, encryptionKey), encryptionKey));
    }

    @Test
    void encrypt_usesANewIvForEveryInvocation() throws Exception {
        String encryptionKey = key(32);

        assertNotEquals(TokenEncryptionUtil.encrypt("same", encryptionKey),
                TokenEncryptionUtil.encrypt("same", encryptionKey));
    }

    @Test
    void decrypt_rejectsWrongKeyAndTampering() throws Exception {
        String encrypted = TokenEncryptionUtil.encrypt("secret", key(32));

        assertThrows(Exception.class, () -> TokenEncryptionUtil.decrypt(encrypted, key(32)));

        byte[] tampered = Base64.getDecoder().decode(encrypted);
        tampered[tampered.length - 1] ^= 1;
        String tamperedValue = Base64.getEncoder().encodeToString(tampered);
        assertThrows(Exception.class, () -> TokenEncryptionUtil.decrypt(tamperedValue, key(32)));
    }

    @Test
    void operations_rejectMalformedInputAndInvalidAesKeys() {
        assertThrows(Exception.class, () -> TokenEncryptionUtil.encrypt("secret", "not-base64"));
        assertThrows(Exception.class, () -> TokenEncryptionUtil.encrypt("secret", key(7)));
        assertThrows(Exception.class, () -> TokenEncryptionUtil.encrypt(null, key(32)));
        assertThrows(Exception.class, () -> TokenEncryptionUtil.decrypt("not-base64", key(32)));
        assertThrows(Exception.class,
                () -> TokenEncryptionUtil.decrypt(Base64.getEncoder().encodeToString(new byte[11]), key(32)));
        assertThrows(Exception.class, () -> TokenEncryptionUtil.decrypt(null, key(32)));
    }

    @Test
    void isEncrypted_identifiesCiphertextVsPlaintext() throws Exception {
        String encryptionKey = key(32);
        String plaintext = "ghp_1234567890abcdef";
        String encrypted = TokenEncryptionUtil.encrypt(plaintext, encryptionKey);

        org.junit.jupiter.api.Assertions.assertTrue(TokenEncryptionUtil.isEncrypted(encrypted, encryptionKey));
        org.junit.jupiter.api.Assertions.assertFalse(TokenEncryptionUtil.isEncrypted(plaintext, encryptionKey));
        org.junit.jupiter.api.Assertions.assertFalse(TokenEncryptionUtil.isEncrypted(null, encryptionKey));
        org.junit.jupiter.api.Assertions.assertFalse(TokenEncryptionUtil.isEncrypted("", encryptionKey));
        org.junit.jupiter.api.Assertions.assertFalse(TokenEncryptionUtil.isEncrypted("short", encryptionKey));
        org.junit.jupiter.api.Assertions.assertFalse(TokenEncryptionUtil.isEncrypted(encrypted, key(32))); // wrong key
    }

    @Test
    void decryptOrPassthrough_handlesBothCiphertextAndPlaintext() throws Exception {
        String encryptionKey = key(32);
        String plaintext = "ghp_test_token_value";
        String encrypted = TokenEncryptionUtil.encrypt(plaintext, encryptionKey);

        assertEquals(plaintext, TokenEncryptionUtil.decryptOrPassthrough(encrypted, encryptionKey));
        assertEquals(plaintext, TokenEncryptionUtil.decryptOrPassthrough(plaintext, encryptionKey));
        assertEquals(null, TokenEncryptionUtil.decryptOrPassthrough(null, encryptionKey));
        assertEquals("", TokenEncryptionUtil.decryptOrPassthrough("", encryptionKey));
    }

    @Test
    void hashSha256_computesDeterministicHexHash() {
        String raw = "sample-invitation-token-12345";
        String hash1 = TokenEncryptionUtil.hashSha256(raw);
        String hash2 = TokenEncryptionUtil.hashSha256(raw);

        assertEquals(hash1, hash2);
        assertEquals(64, hash1.length());
        org.junit.jupiter.api.Assertions.assertNotEquals(raw, hash1);
        org.junit.jupiter.api.Assertions.assertNull(TokenEncryptionUtil.hashSha256(null));
    }
}
