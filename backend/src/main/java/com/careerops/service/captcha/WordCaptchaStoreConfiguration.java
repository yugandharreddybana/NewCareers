package com.careerops.service.captcha;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.data.redis.core.StringRedisTemplate;

@Configuration
public class WordCaptchaStoreConfiguration {

    @Value("${ratelimit.require-shared-store:false}")
    private boolean requireSharedStore;

    @Value("${auth.word-captcha.require-redis:false}")
    private boolean requireWordCaptchaRedis;

    @Autowired(required = false)
    private StringRedisTemplate redisTemplate;

    private final Environment environment;

    public WordCaptchaStoreConfiguration(Environment environment) {
        this.environment = environment;
    }

    @PostConstruct
    void validateSharedStoreWhenRequired() {
        if (!requiresSharedStore()) {
            return;
        }
        if (redisTemplate == null) {
            throw new IllegalStateException(
                    "Word CAPTCHA shared store requires Redis, but no StringRedisTemplate is configured.");
        }
        try {
            String pong = redisTemplate.execute(
                    (org.springframework.data.redis.core.RedisCallback<String>) connection -> connection.ping());
            if (pong == null || !"PONG".equalsIgnoreCase(pong)) {
                throw new IllegalStateException("Word CAPTCHA shared store requires a reachable Redis instance.");
            }
        } catch (Exception e) {
            throw new IllegalStateException("Word CAPTCHA shared store requires a reachable Redis instance.", e);
        }
    }

    @Bean
    @Primary
    WordCaptchaStore wordCaptchaStore(InMemoryWordCaptchaStore inMemory) {
        if (redisTemplate != null) {
            return new RedisWordCaptchaStore(redisTemplate);
        }
        if (requiresSharedStore()) {
            throw new IllegalStateException(
                    "Word CAPTCHA shared store requires Redis in prod/staging.");
        }
        return inMemory;
    }

    private boolean requiresSharedStore() {
        return requireSharedStore
                || requireWordCaptchaRedis
                || environment.acceptsProfiles(Profiles.of("prod", "staging", "production"));
    }
}
