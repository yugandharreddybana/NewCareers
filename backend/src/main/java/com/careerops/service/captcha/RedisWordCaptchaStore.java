package com.careerops.service.captcha;

import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

public class RedisWordCaptchaStore implements WordCaptchaStore {

    private static final Duration TTL = Duration.ofSeconds(600);
    private static final String KEY_PREFIX = "captcha:";

    private final StringRedisTemplate redis;

    public RedisWordCaptchaStore(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @Override
    public void put(String challengeId, String expectedAnswer, Instant expiresAt) {
        long seconds = Math.max(1, Duration.between(Instant.now(), expiresAt).getSeconds());
        redis.opsForValue().set(KEY_PREFIX + challengeId, expectedAnswer, Duration.ofSeconds(seconds));
    }

    @Override
    public Optional<String> removeIfValid(String challengeId) {
        String key = KEY_PREFIX + challengeId;
        String expected = redis.opsForValue().getAndDelete(key);
        if (expected == null || expected.isBlank()) {
            return Optional.empty();
        }
        return Optional.of(expected);
    }
}
