package com.careerops.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Component
public class InternalHmacSigner {

    public static final String TIMESTAMP_HEADER = "X-Timestamp";
    public static final String SIGNATURE_HEADER = "X-Signature";
    public static final long DEFAULT_MAX_SKEW_MS = 300_000L;

    private final byte[] secretBytes;

    @Autowired
    public InternalHmacSigner(@Value("${app.internal.secret}") String secret) {
        if (secret == null || secret.isBlank() || secret.length() < 32
                || "CHANGE_ME_LONG_RANDOM_STRING".equals(secret)) {
            throw new IllegalStateException(
                    "FATAL: APP_INTERNAL_SECRET must be at least 32 characters (set in .env or secret store).");
        }
        this.secretBytes = secret.getBytes(StandardCharsets.UTF_8);
    }

    /** Test-only factory — not a Spring bean constructor. */
    static InternalHmacSigner forTest(byte[] secretBytes) {
        if (secretBytes == null || secretBytes.length < 32) {
            throw new IllegalArgumentException("HMAC secret must be at least 32 bytes");
        }
        return new InternalHmacSigner(secretBytes.clone());
    }

    private InternalHmacSigner(byte[] secretBytes) {
        this.secretBytes = secretBytes;
    }

    public String sign(long timestampMs, String method, String path, byte[] body) {
        return hmacHex(buildPayload(timestampMs, method, path, body));
    }

    public boolean verify(long timestampMs, String method, String path, byte[] body, String signatureHex) {
        if (signatureHex == null || signatureHex.isBlank()) {
            return false;
        }
        String expected = sign(timestampMs, method, path, body);
        byte[] expectedBytes = expected.getBytes(StandardCharsets.UTF_8);
        byte[] actualBytes = signatureHex.trim().toLowerCase().getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(expectedBytes, actualBytes);
    }

    /** Pre-fix UTF-8 body decoding — debug only to detect stale verification behavior. */
    boolean verifyLegacyUtf8Body(long timestampMs, String method, String path, byte[] body, String signatureHex) {
        if (signatureHex == null || signatureHex.isBlank()) {
            return false;
        }
        String normalizedMethod = method == null ? "" : method.toUpperCase();
        String normalizedPath = path == null ? "" : path;
        String bodyText = body == null || body.length == 0
                ? ""
                : new String(body, StandardCharsets.UTF_8);
        String payload = timestampMs + normalizedMethod + normalizedPath + bodyText;
        return MessageDigest.isEqual(
                hmacHex(payload).getBytes(StandardCharsets.UTF_8),
                signatureHex.trim().toLowerCase().getBytes(StandardCharsets.UTF_8));
    }

    public boolean isTimestampFresh(long timestampMs) {
        return isTimestampFresh(timestampMs, DEFAULT_MAX_SKEW_MS);
    }

    public boolean isTimestampFresh(long timestampMs, long maxSkewMs) {
        long now = System.currentTimeMillis();
        return Math.abs(now - timestampMs) <= maxSkewMs;
    }

    /**
     * Body bytes are decoded as ISO-8859-1 to match middleware {@code bytesForSigning}
     * (Node {@code buffer.toString('latin1')}) for multipart/binary forwards.
     */
    static String buildPayload(long timestampMs, String method, String path, byte[] body) {
        String normalizedMethod = method == null ? "" : method.toUpperCase();
        String normalizedPath = path == null ? "" : path;
        String bodyText = body == null || body.length == 0
                ? ""
                : new String(body, StandardCharsets.ISO_8859_1);
        return timestampMs + normalizedMethod + normalizedPath + bodyText;
    }

    private String hmacHex(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secretBytes, "HmacSHA256"));
            byte[] digest = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return toHex(digest);
        } catch (Exception e) {
            throw new IllegalStateException("HMAC signing failed", e);
        }
    }

    private static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
