package com.careerops.config;

import org.springframework.cache.interceptor.KeyGenerator;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.util.UUID;

/**
 * Custom key generator that produces cache keys in the pattern
 * {@code "<userId>:<suffix>"} for userId-scoped entries.
 *
 * Usage example:
 * <pre>
 *   \@Cacheable(value = CacheConfig.USER_STATS, keyGenerator = "userStatsCacheKeyGenerator")
 * </pre>
 *
 * NOTE: The default {@code JobStatsService} methods use inline SpEL keys
 * (e.g. {@code key = "#userId + ':summary'"}) which are equivalent and
 * preferred for clarity.  This generator is provided as a convenience for
 * callers that prefer annotation-level key generation without SpEL.
 *
 * NOTE: Caffeine does not support wildcard eviction natively, so evictUserStats
 * uses allEntries=true as a safe fallback.  With Redis you can register a
 * custom eviction script; for now full-cache eviction is acceptable given
 * the small TTL (5 min).
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
