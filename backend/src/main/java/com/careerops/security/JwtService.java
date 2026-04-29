package com.careerops.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Service
public class JwtService {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiry.ms}")
    private long expiryMs;

    private SecretKey key() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

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

    public String parseUserId(String token) {
        return Jwts.parser().verifyWith(key()).build()
            .parseSignedClaims(token).getPayload().getSubject();
    }
}
