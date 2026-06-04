package com.careerops.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
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
 * Cache configuration – Batch 4.
 *
 * Strategy:
 *   – When Redis is available (spring.data.redis.host is set) a
 *     {@link RedisCacheManager} is used so the cache survives restarts
 *     and is shared across pods.
 *   – Otherwise a local {@link com.github.benmanes.caffeine.cache.Cache}
 *     via CaffeineCacheManager is used (ideal for dev / single-instance).
 *
 * Cache names and TTLs
 * ─────────────────────
 *  "userStats"      – per-user derived counts/charts          5 min  / 2 000 entries
 *  "sourceMetadata" – job-source labels / icons               60 min / 500 entries
 *  "companyInfo"    – company logos / descriptions            60 min / 1 000 entries
 *
 * Legacy aliases (kept for backward compat with Batch 1-3 callers)
 * ──────────────────────────────────────────────────────────────────
 *  CACHE_USER_JOB_STATS  → maps to "userStats"
 *  CACHE_FEATURE_FLAGS   → separate cache, 60 min
 */
@Configuration
@EnableCaching
public class CacheConfig {

    // ── Batch 4 cache name constants ─────────────────────────────────────────
    public static final String USER_STATS      = "userStats";
    public static final String SOURCE_METADATA = "sourceMetadata";
    public static final String COMPANY_INFO    = "companyInfo";

    // ── Legacy aliases (Batch 1-3 backward compat) ────────────────────────
    /** @deprecated Use {@link #USER_STATS} */
    @Deprecated
    public static final String CACHE_USER_JOB_STATS = USER_STATS;
    public static final String CACHE_FEATURE_FLAGS  = "featureFlags";

    // ── Caffeine (local, no Redis) ────────────────────────────────────────────
    @Bean
    @Primary
    @ConditionalOnMissingBean(name = "redisCacheManager")
    public CacheManager caffeineCacheManager() {
        com.github.benmanes.caffeine.spring.CaffeineCacheManager manager =
                new com.github.benmanes.caffeine.spring.CaffeineCacheManager();

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

        manager.registerCustomCache(CACHE_FEATURE_FLAGS,
                Caffeine.newBuilder()
                        .expireAfterWrite(60, TimeUnit.MINUTES)
                        .maximumSize(200)
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
        perCacheConfig.put(USER_STATS,      defaultCfg.entryTtl(Duration.ofMinutes(5)));
        perCacheConfig.put(SOURCE_METADATA, defaultCfg.entryTtl(Duration.ofMinutes(60)));
        perCacheConfig.put(COMPANY_INFO,    defaultCfg.entryTtl(Duration.ofMinutes(60)));
        perCacheConfig.put(CACHE_FEATURE_FLAGS, defaultCfg.entryTtl(Duration.ofMinutes(60)));

        return RedisCacheManager.builder(factory)
                .cacheDefaults(defaultCfg.entryTtl(Duration.ofMinutes(10)))
                .withInitialCacheConfigurations(perCacheConfig)
                .build();
    }
}
