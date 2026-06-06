package com.careerops.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.context.config.annotation.RefreshScope;
import org.springframework.stereotype.Service;

import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.interfaces.RSAPublicKey;
import java.util.Date;

/**
 * JWT utility service — RS256 with RSA key pair (PKCS#8 private, SPKI public).
 *
 * 3.012 — Added @RefreshScope for dynamic key rotation.
 */
@Service
@RefreshScope
public class JwtService {

    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(JwtService.class);
    private static final int MIN_RSA_BITS = 2048;

    private final PrivateKey privateKey;
    private final PublicKey publicKey;

    @Value("${jwt.expiry.ms}")
    private long expiryMs;

    public JwtService(@Value("${jwt.private-key-pem:}") String privateKeyPem,
                      @Value("${jwt.public-key-pem:}") String publicKeyPem) {
        if (privateKeyPem == null || privateKeyPem.isBlank() || publicKeyPem == null || publicKeyPem.isBlank()) {
            throw new IllegalStateException(
                    "JWT RSA keypair must be configured via JWT_PRIVATE_KEY_PEM / JWT_PUBLIC_KEY_PEM "
                            + "(jwt.private-key-pem / jwt.public-key-pem)");
        }

        try {
            this.privateKey = RsaKeyMaterialParser.parsePrivateKey(privateKeyPem);
            this.publicKey = RsaKeyMaterialParser.parsePublicKey(publicKeyPem);
        } catch (RsaKeyMaterialParser.GeneralSecurityExceptionWrapper e) {
            throw new IllegalStateException("Failed to initialize RSA keys for JWT", e.getCause());
        }
    }

    @jakarta.annotation.PostConstruct
    public void validateConfiguration() {
        if (expiryMs <= 0 || expiryMs > 86400000L) {
            throw new IllegalStateException("JWT expiryMs must be > 0 and <= 86400000 ms (24 hours).");
        }
        if (!(publicKey instanceof RSAPublicKey rsa) || rsa.getModulus().bitLength() < MIN_RSA_BITS) {
            throw new IllegalStateException("JWT RSA public key must be at least " + MIN_RSA_BITS + " bits");
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
            .signWith(privateKey, Jwts.SIG.RS256)
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

    public Claims validate(String token) {
        return claims(token);
    }

    public boolean isTokenValid(String token) {
        try {
            claims(token);
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
}
