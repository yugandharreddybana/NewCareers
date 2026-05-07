package com.careerops.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * 3.030 — Per-user rate limiting for high-cost or sensitive endpoints.
 * Uses Bucket4j with Caffeine for memory-efficient bucket management.
 */
@Service
@SuppressWarnings("deprecation")
public class RateLimitService {

    // Cache of buckets to prevent memory leaks with many users
    private final Cache<UUID, Bucket> cvDownloadBuckets = Caffeine.newBuilder()
            .expireAfterAccess(1, TimeUnit.HOURS)
            .maximumSize(10000)
            .build();

    /**
     * Attempts to consume 1 token for a CV download request.
     * Limit: 10 downloads per minute per user.
     */
    public boolean tryConsumeCvDownload(UUID userId) {
        Bucket bucket = cvDownloadBuckets.get(userId, id -> {
            Refill refill = Refill.greedy(10, Duration.ofMinutes(1));
            Bandwidth limit = Bandwidth.classic(10, refill);
            return Bucket.builder()
                    .addLimit(limit)
                    .build();
        });
        return bucket.tryConsume(1);
    }
}
