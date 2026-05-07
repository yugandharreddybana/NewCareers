package com.careerops.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.context.config.annotation.RefreshScope;
import org.springframework.stereotype.Service;

import java.security.*;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.Date;

/**
 * JWT utility service — upgraded to RS256.
 * 
 * 3.012 — Added @RefreshScope for dynamic key rotation.
 */
@Service
@RefreshScope
public class JwtService {

    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(JwtService.class);

    private final PrivateKey privateKey;
    private final PublicKey publicKey;

    @Value("${jwt.expiry.ms}")
    private long expiryMs;

    public JwtService(@Value("${jwt.private-key:}") String privateKeyPem,
                      @Value("${jwt.public-key:}") String publicKeyPem) {
        if (privateKeyPem == null || privateKeyPem.isBlank() || publicKeyPem == null || publicKeyPem.isBlank()) {
            throw new IllegalStateException("JWT RSA keypair must be configured via jwt.private-key and jwt.public-key");
        }

        try {
            KeyFactory keyFactory = KeyFactory.getInstance("RSA");
            this.privateKey = keyFactory.generatePrivate(new PKCS8EncodedKeySpec(decodeKeyMaterial(privateKeyPem, "PRIVATE KEY")));
            this.publicKey = keyFactory.generatePublic(new X509EncodedKeySpec(decodeKeyMaterial(publicKeyPem, "PUBLIC KEY")));
        } catch (Exception e) {
            throw new IllegalStateException("Failed to initialize RSA keys for JWT", e);
        }
    }

    @jakarta.annotation.PostConstruct
    public void validateExpiry() {
        if (expiryMs <= 0 || expiryMs > 86400000L) {
            throw new IllegalStateException("JWT expiryMs must be > 0 and <= 86400000 ms (24 hours).");
        }
    }

    private static final java.util.Set<String> revokedJtis = java.util.concurrent.ConcurrentHashMap.newKeySet();

    // ---- token minting -------------------------------------------------------

    public String issue(String userId, String email) {
        Date now = new Date();
        return Jwts.builder()
            .issuer("careerops")
            .audience().add("web|mobile").and()
            .id(java.util.UUID.randomUUID().toString())
            .subject(userId)
            .claim("email", email)
            .issuedAt(now)
            .expiration(new Date(now.getTime() + expiryMs))
            .signWith(privateKey)
            .compact();
    }

    public void revokeToken(String token) {
        try {
            Claims cl = Jwts.parser().verifyWith(publicKey).build().parseSignedClaims(token).getPayload();
            if (cl.getId() != null) {
                revokedJtis.add(cl.getId());
            }
        } catch (Exception ignored) {
        }
    }

    public void revokeTokenByJti(String jti) {
        if (jti != null) {
            revokedJtis.add(jti);
        }
    }

    public PublicKey getPublicKey() {
        return publicKey;
    }

    // ---- claim extraction ----------------------------------------------------

    public String parseUserId(String token) {
        return claims(token).getSubject();
    }

    public String extractUserId(String token) {
        return parseUserId(token);
    }

    public String extractEmail(String token) {
        String email = claims(token).get("email", String.class);
        if (email == null) {
            throw com.careerops.exception.ApiException.unauthorized("malformed token");
        }
        return email;
    }


    // ---- validation ----------------------------------------------------------

    public boolean isTokenValid(String token) {
        try {
            claims(token); // throws on invalid / expired
            return true;
        } catch (io.jsonwebtoken.ExpiredJwtException e) {
            logger.warn("JWT token has expired: {}", e.getMessage());
            return false;
        } catch (io.jsonwebtoken.security.SignatureException e) {
            logger.warn("JWT signature validation failed: {}", e.getMessage());
            return false;
        } catch (io.jsonwebtoken.MalformedJwtException e) {
            logger.warn("JWT is malformed: {}", e.getMessage());
            return false;
        } catch (Exception e) {
            logger.warn("JWT generic validation failure: {}", e.getMessage());
            return false;
        }
    }


    // ---- internal ------------------------------------------------------------

    private Claims claims(String token) {
        Claims cl = Jwts.parser()
            .verifyWith(publicKey)
            .build()
            .parseSignedClaims(token)
            .getPayload();

        if (!"careerops".equals(cl.getIssuer())) {
            throw new io.jsonwebtoken.JwtException("Invalid token issuer");
        }
        if (cl.getAudience() == null || !cl.getAudience().contains("web|mobile")) {
            throw new io.jsonwebtoken.JwtException("Invalid token audience");
        }
        if (cl.getId() != null && revokedJtis.contains(cl.getId())) {
            throw new io.jsonwebtoken.JwtException("Token has been revoked");
        }
        return cl;
    }

    private static byte[] decodeKeyMaterial(String value, String label) {
        String normalized = value.replace("\\n", "\n").trim();
        String header = "-----BEGIN " + label + "-----";
        String footer = "-----END " + label + "-----";
        if (normalized.contains(header)) {
            normalized = normalized.replace(header, "").replace(footer, "");
        }
        return Base64.getDecoder().decode(normalized.replaceAll("\\s", ""));
    }
}


