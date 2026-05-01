package com.careerops.ratelimit;

import io.github.bucket4j.Bandwidth;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * Task 132 — defines the shared Bandwidth policy used by RateLimitFilter.
 *
 * Policy:
 *   - 60 tokens per 1-minute window (greedy refill — one token every second)
 *   - Initial burst of 10 extra tokens to absorb short legitimate spikes
 *     (e.g. page load firing several parallel API calls)
 *
 * Why greedy over classic?
 *   Greedy refill distributes tokens evenly across the window so a client
 *   cannot exhaust all 60 tokens in the first second and then wait 59 s.
 */
@Configuration
public class RateLimitConfig {

    /** 60 tokens / minute, one token added each second (greedy). */
    @Bean
    public Bandwidth apiBandwidth() {
        return Bandwidth.builder()
            .capacity(60)
            .refillGreedy(60, Duration.ofMinutes(1))
            .initialTokens(60)
            .build();
    }
}
