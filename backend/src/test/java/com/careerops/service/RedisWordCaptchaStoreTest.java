package com.careerops.service;

import com.careerops.service.captcha.RedisWordCaptchaStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RedisWordCaptchaStoreTest {

    private StringRedisTemplate redis;
    private ValueOperations<String, String> valueOps;
    private RedisWordCaptchaStore store;

    @BeforeEach
    void setUp() {
        redis = mock(StringRedisTemplate.class);
        valueOps = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(valueOps);
        store = new RedisWordCaptchaStore(redis);
    }

    @Test
    @DisplayName("put stores answer under captcha: prefix with TTL")
    void putUsesPrefixedKey() {
        Instant expiresAt = Instant.now().plusSeconds(600);
        store.put("abc-123", "XY2Z9", expiresAt);

        verify(valueOps).set(eq("captcha:abc-123"), eq("XY2Z9"), any(Duration.class));
    }

    @Test
    @DisplayName("removeIfValid returns and deletes stored answer")
    void removeIfValidRemovesKey() {
        when(valueOps.getAndDelete("captcha:abc-123")).thenReturn("XY2Z9");

        Optional<String> answer = store.removeIfValid("abc-123");

        assertThat(answer).contains("XY2Z9");
    }

    @Test
    @DisplayName("removeIfValid returns empty when key missing")
    void removeIfValidMissingKey() {
        when(valueOps.getAndDelete("captcha:missing")).thenReturn(null);

        assertThat(store.removeIfValid("missing")).isEmpty();
    }
}
