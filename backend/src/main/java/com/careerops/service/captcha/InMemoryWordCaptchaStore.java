package com.careerops.service.captcha;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class InMemoryWordCaptchaStore implements WordCaptchaStore {

    private final Map<String, Entry> challenges = new ConcurrentHashMap<>();

    @Override
    public void put(String challengeId, String expectedAnswer, Instant expiresAt) {
        challenges.put(challengeId, new Entry(expectedAnswer, expiresAt));
    }

    @Override
    public Optional<String> removeIfValid(String challengeId) {
        Entry entry = challenges.remove(challengeId);
        if (entry == null || Instant.now().isAfter(entry.expiresAt())) {
            return Optional.empty();
        }
        return Optional.of(entry.expectedAnswer());
    }

    private record Entry(String expectedAnswer, Instant expiresAt) {}
}
