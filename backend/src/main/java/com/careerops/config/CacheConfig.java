package com.careerops.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Cache configuration for Batch 4.
 *
 * Strategy:
 *   - When Redis is available (spring.data.redis.host is set) a
 *     {@link RedisCacheManager} is used so cache survives restarts
 *     and is shared across pods.
 *   - Otherwise a local {@link CaffeineCacheManager} is used
 *     (ideal for dev / single-instance deployments).
 *
 * Cache names and TTLs
 * ─────────────────────
 *  "userStats"      – per-user derived counts/charts          5 min
 *  "sourceMetadata" – job-source labels / icons               60 min
 *  "companyInfo"    – company logos / descriptions            60 min
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

    public static final String USER_STATS       = "userStats";
    public static final String SOURCE_METADATA  = "sourceMetadata";
    public static final String COMPANY_INFO     = "companyInfo";

    // ── Caffeine (local, no Redis) ────────────────────────────────────────────
    @Bean
    @Primary
    @ConditionalOnMissingBean(name = "redisCacheManager")
    public CacheManager caffeineCacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager();

        // Per-cache specs registered explicitly so TTLs differ
        manager.registerCustomCache(USER_STATS,
            Caffeine.newBuilder()
                .expireAfterWrite(5, TimeUnit.MINUTES)
                .maximumSize(2_000)
                .recordStats()
                .build());

        manager.registerCustomCache(SOURCE_METADATA,
            Caffeine.newBuilder()
                .expireAfterWrite(60, TimeUnit.MINUTES)
                .maximumSize(500)
                .recordStats()
                .build());

        manager.registerCustomCache(COMPANY_INFO,
            Caffeine.newBuilder()
                .expireAfterWrite(60, TimeUnit.MINUTES)
                .maximumSize(1_000)
                .recordStats()
                .build());

        return manager;
    }

    // ── Redis (production, multi-instance) ───────────────────────────────────
    @Bean("redisCacheManager")
    @ConditionalOnProperty(name = "spring.data.redis.host")
    public CacheManager redisCacheManager(RedisConnectionFactory factory) {
        GenericJackson2JsonRedisSerializer serializer =
            new GenericJackson2JsonRedisSerializer();

        RedisCacheConfiguration defaultCfg = RedisCacheConfiguration.defaultCacheConfig()
            .serializeValuesWith(
                RedisSerializationContext.SerializationPair.fromSerializer(serializer))
            .disableCachingNullValues();

        Map<String, RedisCacheConfiguration> perCacheConfig = new HashMap<>();
        perCacheConfig.put(USER_STATS,
            defaultCfg.entryTtl(Duration.ofMinutes(5)));
        perCacheConfig.put(SOURCE_METADATA,
            defaultCfg.entryTtl(Duration.ofMinutes(60)));
        perCacheConfig.put(COMPANY_INFO,
            defaultCfg.entryTtl(Duration.ofMinutes(60)));

        return RedisCacheManager.builder(factory)
            .cacheDefaults(defaultCfg.entryTtl(Duration.ofMinutes(10)))
            .withInitialCacheConfigurations(perCacheConfig)
            .build();
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
