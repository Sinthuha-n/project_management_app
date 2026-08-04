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
}
