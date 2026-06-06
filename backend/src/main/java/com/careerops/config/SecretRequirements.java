package com.careerops.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import jakarta.annotation.PostConstruct;

/**
 * Fail-fast validation for required secrets on runtime profiles.
 * Secrets must come from gitignored {@code .env}, platform env injection, or AWS Secrets Manager — never from committed properties.
 */
@Configuration
@Profile("!test & !openapi")
public class SecretRequirements {

    @Value("${app.internal.secret:}")
    private String internalSecret;

    @Value("${app.master.kek:}")
    private String masterKek;

    @Value("${jwt.private-key-pem:}")
    private String jwtPrivateKeyPem;

    @Value("${jwt.public-key-pem:}")
    private String jwtPublicKeyPem;

    @PostConstruct
    void validateRequiredSecrets() {
        requireEnv("APP_INTERNAL_SECRET", internalSecret, 32);
        requireEnv("APP_MASTER_KEK", masterKek, 32);
        requireEnv("JWT_PRIVATE_KEY_PEM", jwtPrivateKeyPem, 1);
        requireEnv("JWT_PUBLIC_KEY_PEM", jwtPublicKeyPem, 1);
    }

    private static void requireEnv(String envName, String value, int minLength) {
        if (value == null || value.isBlank() || value.length() < minLength) {
            throw new IllegalStateException(
                    "FATAL: " + envName + " must be set (via .env, platform env, or AWS Secrets Manager). "
                            + "Do not put secrets in application.properties.");
        }
    }
}
