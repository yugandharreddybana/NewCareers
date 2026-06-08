package com.careerops.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.Map;

/**
 * 3.002 — Captcha Service for brute-force protection.
 * Verifies tokens against Google reCAPTCHA.
 */
@Service
public class CaptchaService {
    private static final Logger log = LoggerFactory.getLogger(CaptchaService.class);

    private final WebClient client;
    private final String secret;
    private final Environment environment;

    public CaptchaService(WebClient.Builder b,
                          @Value("${captcha.secret:}") String secret,
                          Environment environment) {
        this.client = b.baseUrl("https://www.google.com/recaptcha/api").build();
        this.secret = secret;
        this.environment = environment;
    }

    private boolean isFailClosedProfile() {
        return environment.acceptsProfiles(Profiles.of("prod", "staging", "production"));
    }

    public boolean isConfigured() {
        return secret != null && !secret.isBlank() && !secret.startsWith("YOUR_");
    }

    public boolean verify(String token) {
        if (!isConfigured()) {
            if (isFailClosedProfile()) {
                log.error("Captcha secret not configured in prod/staging — failing closed");
                return false;
            }
            log.warn("Captcha secret not configured. Allowing all requests in dev mode.");
            return true;
        }
        if (token == null || token.isBlank()) return false;

        try {
            Map<?, ?> resp = client.post()
                .uri("/siteverify")
                .bodyValue("secret=" + secret + "&response=" + token)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .retrieve()
                .bodyToMono(Map.class)
                .block();

            return resp != null && Boolean.TRUE.equals(resp.get("success"));
        } catch (Exception e) {
            log.error("Captcha verification failed: {}", e.getMessage());
            return false;
        }
    }
}
