package com.careerops.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;

@Service
public class ResendEmailService {
    private static final Logger log = LoggerFactory.getLogger(ResendEmailService.class);

    private final WebClient client;
    private final String key;
    private final String from;

    public ResendEmailService(WebClient.Builder b,
                              @Value("${resend.api.key}") String key,
                              @Value("${resend.from}") String from) {
        this.key = key; this.from = from;
        this.client = b.baseUrl("https://api.resend.com").build();
    }

    public void sendOtp(String to, String otp) {
        if (key == null || key.isBlank() || key.startsWith("YOUR_")) {
            log.info("[DEV] Reset OTP for {} = {}", to, otp);
            return;
        }
        try {
            client.post().uri("/emails")
                .header("Authorization", "Bearer " + key)
                .header("Content-Type", "application/json")
                .bodyValue(Map.of(
                    "from", from,
                    "to", new String[]{to},
                    "subject", "Your CareerOps password reset code",
                    "html", "<p>Your code: <b>" + otp + "</b> (valid 15 minutes)</p>"
                ))
                .retrieve().bodyToMono(String.class).block();
        } catch (Exception e) {
            log.warn("Resend failed, OTP for {} = {}", to, otp);
        }
    }
}
