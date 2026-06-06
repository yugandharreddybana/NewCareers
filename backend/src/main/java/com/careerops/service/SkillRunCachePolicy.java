package com.careerops.service;

import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Set;

/**
 * Shared TTL policy for job-scoped skill-run caching.
 * Cache lookup uses {@code expires_at}; see {@link com.careerops.repository.SkillRunRepository#findValidCachedRun}.
 */
public final class SkillRunCachePolicy {

    public static final int DEFAULT_CACHE_TTL_HOURS = 24;
    public static final int TAILOR_CACHE_TTL_HOURS = 48;

    public static final Set<String> CACHEABLE_SKILLS = Set.of(
            "evaluate",
            "research",
            "prep-interview",
            "apply",
            "outreach",
            "tailor-resume"
    );

    private SkillRunCachePolicy() {}

    public static boolean isCacheable(String skill) {
        return CACHEABLE_SKILLS.contains(skill);
    }

    public static @Nullable Instant computeExpiry(String skill) {
        if (!isCacheable(skill)) {
            return null;
        }
        int hours = "tailor-resume".equals(skill) ? TAILOR_CACHE_TTL_HOURS : DEFAULT_CACHE_TTL_HOURS;
        return Instant.now().plus(hours, ChronoUnit.HOURS);
    }
}
