package com.careerops.security;

import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.InputStream;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String PRIVATE_KEY;
    private static final String PUBLIC_KEY;

    static {
        try (InputStream in = JwtServiceTest.class.getClassLoader().getResourceAsStream("application-test.properties")) {
            Properties props = new Properties();
            props.load(in);
            PRIVATE_KEY = props.getProperty("jwt.private-key");
            PUBLIC_KEY = props.getProperty("jwt.public-key");
        } catch (Exception e) {
            throw new ExceptionInInitializerError(e);
        }
    }

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService(PRIVATE_KEY, PUBLIC_KEY);
        ReflectionTestUtils.setField(jwtService, "expiryMs", 900_000L);
        jwtService.validateConfiguration();
    }

    @Test
    @DisplayName("issue() and validate() round-trip")
    void issueAndValidateRoundTrip() {
        String token = jwtService.issue("user-123", "dev@careerops.test");
        var claims = jwtService.validate(token);
        assertThat(claims.getSubject()).isEqualTo("user-123");
        assertThat(claims.get("email", String.class)).isEqualTo("dev@careerops.test");
        assertThat(jwtService.isTokenValid(token)).isTrue();
    }

    @Test
    @DisplayName("tampered token fails validation")
    void tamperedTokenFailsValidation() {
        String token = jwtService.issue("user-123", "dev@careerops.test");
        String tampered = token.substring(0, token.length() - 1)
                + (token.endsWith("a") ? "b" : "a");
        assertThat(jwtService.isTokenValid(tampered)).isFalse();
        assertThatThrownBy(() -> jwtService.validate(tampered)).isInstanceOf(JwtException.class);
    }

    @Test
    @DisplayName("getPublicKey returns RSA key for JWKS")
    void publicKeyIsRsa() {
        assertThat(jwtService.getPublicKey().getAlgorithm()).isEqualTo("RSA");
    }
}
