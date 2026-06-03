package com.careerops.service;

import com.careerops.config.CacheConfig;
import com.careerops.dto.JobStatsDto;
import com.careerops.repository.UserJobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Computes and caches per-user job statistics.
 *
 * All read methods are annotated with {@code @Cacheable} using the
 * "userStats" cache (TTL 5 min via {@link CacheConfig}).  Write paths
 * that mutate UserJob rows call {@code @CacheEvict} so stale stats are
 * never served after a state change.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class JobStatsService {

    private final UserJobRepository userJobRepository;

    // ── Read (cached) ─────────────────────────────────────────────────────────

    /**
     * Returns aggregated stats for the dashboard header cards.
     * Result is cached per userId for 5 minutes.
     */
    @Cacheable(value = CacheConfig.USER_STATS, key = "#userId + ':summary'")
    @Transactional(readOnly = true)
    public JobStatsDto getSummaryStats(UUID userId) {
        log.debug("[JobStatsService] cache miss – computing summary stats for user {}", userId);

        long total     = userJobRepository.countByUserId(userId);
        double avgMatch = userJobRepository.avgMatchPercentForUser(userId);
        long withScore  = userJobRepository.countByUserIdAndScoreBreakdownIsNotNull(userId);

        Map<String, Long> byColumn = new LinkedHashMap<>();
        userJobRepository.countByColumnForUser(userId)
            .forEach(row -> byColumn.put((String) row[0], (Long) row[1]));

        return JobStatsDto.builder()
            .totalJobs(total)
            .avgMatchPercent(avgMatch)
            .jobsWithAiScore(withScore)
            .byKanbanColumn(byColumn)
            .build();
    }

    /**
     * Returns activity stats for the last N days (used by chart endpoints).
     * Cached per userId + days combination.
     */
    @Cacheable(value = CacheConfig.USER_STATS, key = "#userId + ':activity:' + #days")
    @Transactional(readOnly = true)
    public Map<String, Long> getActivityStats(UUID userId, int days) {
        log.debug("[JobStatsService] cache miss – computing activity stats for user {} days={}", userId, days);

        Instant since = Instant.now().minus(days, ChronoUnit.DAYS);
        Map<String, Long> stats = new LinkedHashMap<>();
        stats.put("totalInPeriod",    userJobRepository.countByUserIdAndDeliveredAtAfter(userId, since));
        stats.put("appliedInPeriod",  userJobRepository.countByUserIdAndKanbanColumnAndDeliveredAtAfter(userId, "Applied", since));
        stats.put("interviewInPeriod",userJobRepository.countByUserIdAndKanbanColumnAndDeliveredAtAfter(userId, "Interview", since));
        stats.put("offerInPeriod",    userJobRepository.countByUserIdAndKanbanColumnAndDeliveredAtAfter(userId, "Offer", since));
        return stats;
    }

    // ── Eviction ──────────────────────────────────────────────────────────────

    /**
     * Call this whenever a UserJob is created, updated, or deleted for a user
     * so all cached stats entries for that user are invalidated.
     */
    @CacheEvict(value = CacheConfig.USER_STATS, allEntries = false,
                keyGenerator = "userStatsCacheKeyGenerator")
    public void evictUserStats(UUID userId) {
        log.debug("[JobStatsService] evicting userStats cache for user {}", userId);
    }

    /**
     * Convenience method that accepts a userId string (useful from event
     * listeners / Spring events where typed UUID may not be available).
     */
    @CacheEvict(value = CacheConfig.USER_STATS, allEntries = true)
    public void evictAllUserStats() {
        log.info("[JobStatsService] full userStats cache eviction triggered");
    }
}
