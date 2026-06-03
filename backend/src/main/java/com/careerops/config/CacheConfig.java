package com.careerops.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

/**
 * Caffeine-backed in-memory cache configuration.
 *
 * Cache name        | TTL    | Max entries | Purpose
 * ───────────────── | ─────  | ─────────── | ───────────────────────────────
 * jobs              | 5 min  | 5 000       | Per-user job listing results
 * userProfile       | 10 min | 2 000       | User profile reads
 * jobStats          | 5 min  | 2 000       | Dashboard aggregates / counts
 * aiResult          | 60 min | 10 000      | AI match scores per (user, job)
 * sourceMetadata    | 60 min | 500         | Company / source metadata
 */
@EnableCaching
@Configuration
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager();
        // Default spec — overridden per cache below via explicit registration
        manager.setCaffeine(defaultSpec());

        // Register named caches with individual specs
        manager.registerCustomCache("jobs",
                Caffeine.newBuilder().maximumSize(5_000).expireAfterWrite(5, TimeUnit.MINUTES).recordStats().build());
        manager.registerCustomCache("userProfile",
                Caffeine.newBuilder().maximumSize(2_000).expireAfterWrite(10, TimeUnit.MINUTES).recordStats().build());
        manager.registerCustomCache("jobStats",
                Caffeine.newBuilder().maximumSize(2_000).expireAfterWrite(5, TimeUnit.MINUTES).recordStats().build());
        manager.registerCustomCache("aiResult",
                Caffeine.newBuilder().maximumSize(10_000).expireAfterWrite(60, TimeUnit.MINUTES).recordStats().build());
        manager.registerCustomCache("sourceMetadata",
                Caffeine.newBuilder().maximumSize(500).expireAfterWrite(60, TimeUnit.MINUTES).recordStats().build());

        return manager;
    }

    private Caffeine<Object, Object> defaultSpec() {
        return Caffeine.newBuilder().maximumSize(2_000).expireAfterWrite(5, TimeUnit.MINUTES);
    }
}
