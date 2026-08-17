package com.planora.backend.util;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

public class TokenEncryptionUtil {

    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int IV_LENGTH_BYTES = 12;
    private static final int GCM_TAG_BITS = 128;
    private static final int MIN_ENCRYPTED_PAYLOAD_BYTES = IV_LENGTH_BYTES + (GCM_TAG_BITS / 8); // 28 bytes

    public static String encrypt(String plaintext, String base64Key) throws Exception {
        if (plaintext == null) {
            throw new IllegalArgumentException("Plaintext cannot be null");
        }
        byte[] keyBytes = decodeKey(base64Key);
        SecretKeySpec secretKey = new SecretKeySpec(keyBytes, "AES");

        byte[] iv = new byte[IV_LENGTH_BYTES];
        new SecureRandom().nextBytes(iv);

        Cipher cipher = Cipher.getInstance(ALGORITHM);
        cipher.init(Cipher.ENCRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_BITS, iv));
        byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

        // Prepend IV to ciphertext, then Base64-encode the whole thing
        byte[] combined = new byte[iv.length + ciphertext.length];
        System.arraycopy(iv, 0, combined, 0, iv.length);
        System.arraycopy(ciphertext, 0, combined, iv.length, ciphertext.length);

        return Base64.getEncoder().encodeToString(combined);
    }

    public static String decrypt(String encoded, String base64Key) throws Exception {
        if (encoded == null) {
            throw new IllegalArgumentException("Encoded ciphertext cannot be null");
        }
        byte[] keyBytes = decodeKey(base64Key);
        SecretKeySpec secretKey = new SecretKeySpec(keyBytes, "AES");

        byte[] combined = Base64.getDecoder().decode(encoded);
        if (combined.length < MIN_ENCRYPTED_PAYLOAD_BYTES) {
            throw new IllegalArgumentException("Ciphertext payload is too short for AES-GCM");
        }
        byte[] iv = new byte[IV_LENGTH_BYTES];
        System.arraycopy(combined, 0, iv, 0, IV_LENGTH_BYTES);
        byte[] ciphertext = new byte[combined.length - IV_LENGTH_BYTES];
        System.arraycopy(combined, IV_LENGTH_BYTES, ciphertext, 0, ciphertext.length);

        Cipher cipher = Cipher.getInstance(ALGORITHM);
        cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_BITS, iv));
        return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
    }

    /**
     * Checks whether a string is an AES-GCM encrypted ciphertext decodable with the given key.
     */
    public static boolean isEncrypted(String value, String base64Key) {
        if (value == null || value.isBlank() || base64Key == null || base64Key.isBlank()) {
            return false;
        }
        try {
            decrypt(value, base64Key);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Decrypts the value if it is encrypted; otherwise returns the original string.
     * This provides seamless backward compatibility for unencrypted legacy tokens.
     */
    public static String decryptOrPassthrough(String value, String base64Key) {
        if (value == null || value.isBlank() || base64Key == null || base64Key.isBlank()) {
            return value;
        }
        try {
            return decrypt(value, base64Key);
        } catch (Exception e) {
            return value;
        }
    }

    /**
     * Hashes a string using SHA-256 (e.g. for invitation tokens or refresh token JTIs).
     */
    public static String hashSha256(String raw) {
        if (raw == null) {
            return null;
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm not available", e);
        }
    }

    private static byte[] decodeKey(String base64Key) {
        if (base64Key == null || base64Key.isBlank()) {
            throw new IllegalArgumentException("Encryption key cannot be null or blank");
        }
        try {
            return Base64.getDecoder().decode(base64Key);
        } catch (IllegalArgumentException e) {
            return Base64.getUrlDecoder().decode(base64Key);
        }
    }
}
