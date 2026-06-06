package com.careerops.security;

import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.nio.charset.StandardCharsets;

/**
 * Adds HMAC headers for MockMvc integration tests (middleware → Java hop).
 */
public final class InternalRequestHeaders {

    public static final String TEST_SECRET = "test-internal-trust-secret-minimum-32-characters-long";

    private static final InternalHmacSigner SIGNER =
            InternalHmacSigner.forTest(TEST_SECRET.getBytes(StandardCharsets.UTF_8));

    private InternalRequestHeaders() {
    }

    public static RequestPostProcessor hmac(String method, String path, byte[] body) {
        long timestamp = System.currentTimeMillis();
        String signature = SIGNER.sign(timestamp, method, path, body == null ? new byte[0] : body);
        return request -> {
            request.addHeader(InternalHmacSigner.TIMESTAMP_HEADER, String.valueOf(timestamp));
            request.addHeader(InternalHmacSigner.SIGNATURE_HEADER, signature);
            return request;
        };
    }

    public static RequestPostProcessor hmac(String method, String path, String body) {
        byte[] bytes = body == null ? new byte[0] : body.getBytes(StandardCharsets.UTF_8);
        return hmac(method, path, bytes);
    }
}
