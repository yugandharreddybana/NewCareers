package com.careerops.config;

import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Batch 4 – in-process cache layer.
 *
 * Current backend uses no external cache infrastructure, so we wire a simple
 * ConcurrentMapCacheManager (no additional dependency required).
 *
 * Cache names:
 *  - "userJobStats"   : per-user stats DTO (COUNT / AVG queries), TTL managed by
 *                       explicit eviction on write operations in UserJobService.
 *  - "featureFlags"   : rarely-changing feature-flag lookup table.
 *
 * When Redis is added later, replace ConcurrentMapCacheManager with
 * RedisCacheManager and set individual TTLs per cache name via
 * RedisCacheConfiguration.
 */
@Configuration
@EnableCaching
public class CacheConfig {

    public static final String CACHE_USER_JOB_STATS = "userJobStats";
    public static final String CACHE_FEATURE_FLAGS   = "featureFlags";

    @Bean
    public CacheManager cacheManager() {
        return new ConcurrentMapCacheManager(
                CACHE_USER_JOB_STATS,
                CACHE_FEATURE_FLAGS
        );
    }
}
