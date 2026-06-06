package com.careerops.security;

import java.math.BigInteger;
import java.security.MessageDigest;
import java.security.interfaces.RSAPublicKey;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Builds RFC 7517 JWKS documents from an RSA public key.
 */
public final class JwksBuilder {

    private JwksBuilder() {
    }

    public static Map<String, Object> buildJwkSet(RSAPublicKey publicKey) {
        Map<String, Object> jwk = new LinkedHashMap<>();
        jwk.put("kty", "RSA");
        jwk.put("use", "sig");
        jwk.put("alg", "RS256");
        jwk.put("kid", keyId(publicKey));
        jwk.put("n", base64UrlUnsigned(publicKey.getModulus()));
        jwk.put("e", base64UrlUnsigned(publicKey.getPublicExponent()));
        return Map.of("keys", List.of(jwk));
    }

    public static String keyId(RSAPublicKey publicKey) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(publicKey.getEncoded());
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to compute JWKS kid", e);
        }
    }

    private static String base64UrlUnsigned(BigInteger value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(toUnsignedBytes(value));
    }

    private static byte[] toUnsignedBytes(BigInteger value) {
        byte[] bytes = value.toByteArray();
        if (bytes.length > 1 && bytes[0] == 0) {
            byte[] trimmed = new byte[bytes.length - 1];
            System.arraycopy(bytes, 1, trimmed, 0, trimmed.length);
            return trimmed;
        }
        return bytes;
    }
}
