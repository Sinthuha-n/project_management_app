package com.planora.backend.util;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.junit.jupiter.api.Test;

class GithubWebhookSignatureVerifierTest {

    private static final String SECRET = "test-webhook-secret";

    @Test
    void configuration_requiresANonBlankSecret() {
        assertFalse(new GithubWebhookSignatureVerifier(null).isConfigured());
        assertFalse(new GithubWebhookSignatureVerifier("").isConfigured());
        assertFalse(new GithubWebhookSignatureVerifier("  ").isConfigured());
        assertTrue(new GithubWebhookSignatureVerifier(SECRET).isConfigured());
    }

    @Test
    void validSignature_acceptsLowerAndUpperCaseHex() throws Exception {
        String body = "{\"action\":\"opened\"}";
        String signature = sign(body);
        GithubWebhookSignatureVerifier verifier = new GithubWebhookSignatureVerifier(SECRET);

        assertTrue(verifier.isValid(body, signature));
        assertTrue(verifier.isValid(body, "sha256=" + signature.substring(7).toUpperCase()));
    }

    @Test
    void invalidSignatureInputsAreRejected() throws Exception {
        GithubWebhookSignatureVerifier verifier = new GithubWebhookSignatureVerifier(SECRET);
        String body = "payload";

        assertFalse(verifier.isValid(null, sign(body)));
        assertFalse(verifier.isValid(body, null));
        assertFalse(verifier.isValid(body, "sha1=deadbeef"));
        assertFalse(verifier.isValid(body, "sha256=not-hex"));
        assertFalse(verifier.isValid(body + "-altered", sign(body)));
        assertFalse(verifier.isValid(body, "sha256=00"));
        assertFalse(new GithubWebhookSignatureVerifier("").isValid(body, sign(body)));
    }

    private static String sign(String body) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return "sha256=" + HexFormat.of().formatHex(mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));
    }
}
