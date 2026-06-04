package com.careerops.config;

import org.springframework.cache.interceptor.KeyGenerator;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.util.UUID;

/**
 * Custom key generator that produces cache keys in the pattern
 * {@code "<userId>:*"} for userId-scoped entries.
 *
 * Used by {@link com.careerops.service.JobStatsService#evictUserStats(UUID)}
 * to evict all stat variants for one user (summary + activity:N days).
 *
 * NOTE: Caffeine does not support wildcard eviction natively, so the
 * evictUserStats path uses allEntries=true as a safe fallback.  With
 * Redis you can register a custom eviction script; for now full-cache
 * eviction is acceptable given the small TTL (5 min).
 */
@Component("userStatsCacheKeyGenerator")
public class UserStatsCacheKeyGenerator implements KeyGenerator {

    @Override
    public Object generate(Object target, Method method, Object... params) {
        if (params.length > 0 && params[0] instanceof UUID uid) {
            return uid.toString();
        }
        return "all";
    }
}
