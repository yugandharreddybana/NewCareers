package com.careerops.billing;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

/**
 * HMAC verification for non-prod Stripe webhooks. Signature format: {@code mock_v1=<hex>}.
 */
final class StripeMockWebhookSigner {

    private static final String PREFIX = "mock_v1=";

    private StripeMockWebhookSigner() {}

    static String sign(String payload, String secret) {
        return PREFIX + hmacHex(payload, secret);
    }

    static boolean verify(String payload, String signatureHeader, String secret) {
        if (signatureHeader == null || signatureHeader.isBlank() || secret == null || secret.isBlank()) {
            return false;
        }
        if (!signatureHeader.startsWith(PREFIX)) {
            return false;
        }
        String provided = signatureHeader.substring(PREFIX.length());
        String expected = hmacHex(payload, secret);
        return MessageDigest.isEqual(
                provided.getBytes(StandardCharsets.UTF_8),
                expected.getBytes(StandardCharsets.UTF_8));
    }

    private static String hmacHex(String payload, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception ex) {
            throw new IllegalStateException("HMAC failed", ex);
        }
    }
}
