package com.planora.backend.util;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.HexFormat;

/** Verifies GitHub's {@code X-Hub-Signature-256} against the raw request body. */
@Component
public class GithubWebhookSignatureVerifier {

    private static final String SIGNATURE_PREFIX = "sha256=";
    private static final String HMAC_SHA_256 = "HmacSHA256";

    private final String webhookSecret;

    public GithubWebhookSignatureVerifier(@Value("${github.webhook.secret:}") String webhookSecret) {
        this.webhookSecret = webhookSecret;
    }

    public boolean isConfigured() {
        return webhookSecret != null && !webhookSecret.isBlank();
    }

    public boolean isValid(String rawBody, String signature) {
        if (!isConfigured() || rawBody == null || signature == null
                || !signature.startsWith(SIGNATURE_PREFIX)) {
            return false;
        }

        try {
            byte[] received = HexFormat.of().parseHex(signature.substring(SIGNATURE_PREFIX.length()));
            Mac mac = Mac.getInstance(HMAC_SHA_256);
            mac.init(new SecretKeySpec(webhookSecret.getBytes(StandardCharsets.UTF_8), HMAC_SHA_256));
            byte[] expected = mac.doFinal(rawBody.getBytes(StandardCharsets.UTF_8));
            return MessageDigest.isEqual(expected, received);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            return false;
        }
    }
}
