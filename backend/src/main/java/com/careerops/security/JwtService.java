package com.careerops.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * JWT utility service.
 *
 * Methods:
 *   issue(userId, email)         — mint a signed token
 *   parseUserId(token)           — extract the subject (userId)
 *   extractUserId(token)         — alias for parseUserId — used by controllers
 *   extractEmail(token)          — extract the email claim
 *   isTokenValid(token)          — validate signature + expiry without throwing
 */
@Service
public class JwtService {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiry.ms}")
    private long expiryMs;

    private SecretKey key() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    // ---- token minting -------------------------------------------------------

    public String issue(String userId, String email) {
        Date now = new Date();
        return Jwts.builder()
            .subject(userId)
            .claim("email", email)
            .issuedAt(now)
            .expiration(new Date(now.getTime() + expiryMs))
            .signWith(key())
            .compact();
    }

    // ---- claim extraction ----------------------------------------------------

    /**
     * Returns the subject (userId) embedded in the token.
     * Throws JwtException if the token is invalid or expired.
     */
    public String parseUserId(String token) {
        return claims(token).getSubject();
    }

    /**
     * Alias for {@link #parseUserId(String)} — preferred name used by controllers.
     */
    public String extractUserId(String token) {
        return parseUserId(token);
    }

    /**
     * Returns the {@code email} claim embedded in the token.
     */
    public String extractEmail(String token) {
        return claims(token).get("email", String.class);
    }

    // ---- validation ----------------------------------------------------------

    /**
     * Returns {@code true} if the token has a valid signature and has not expired.
     * Does NOT throw — safe to use in filter chains.
     */
    public boolean isTokenValid(String token) {
        try {
            claims(token); // throws on invalid / expired
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    // ---- internal ------------------------------------------------------------

    private Claims claims(String token) {
        return Jwts.parser()
            .verifyWith(key())
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }
}
