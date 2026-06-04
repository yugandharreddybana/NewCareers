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
 *
 * Eviction strategy:
 *   Cached keys are composite: "<userId>:summary" and "<userId>:activity:<days>".
 *   Caffeine does not support key-prefix wildcard eviction, so evictUserStats
 *   uses allEntries=true to flush the entire userStats cache for that user.
 *   Given the small TTL (5 min) and max 2 000 entries this is safe and correct.
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

        long total      = userJobRepository.countByUserId(userId);
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
        stats.put("totalInPeriod",
                userJobRepository.countByUserIdAndDeliveredAtAfter(userId, since));
        stats.put("appliedInPeriod",
                userJobRepository.countByUserIdAndKanbanColumnAndDeliveredAtAfter(userId, "Applied", since));
        stats.put("interviewInPeriod",
                userJobRepository.countByUserIdAndKanbanColumnAndDeliveredAtAfter(userId, "Interview", since));
        stats.put("offerInPeriod",
                userJobRepository.countByUserIdAndKanbanColumnAndDeliveredAtAfter(userId, "Offer", since));
        return stats;
    }

    // ── Eviction ──────────────────────────────────────────────────────────────

    /**
     * Evicts ALL entries in the userStats cache.
     *
     * Cache keys are composite ("<userId>:summary", "<userId>:activity:<days>").
     * Caffeine has no wildcard key eviction, so we flush the whole cache.
     * With a 5-min TTL and max 2 000 entries this is acceptable; other users'
     * entries will be lazily re-populated on next request.
     *
     * Call this whenever a UserJob is created, updated, or deleted.
     */
    @CacheEvict(value = CacheConfig.USER_STATS, allEntries = true)
    public void evictUserStats(UUID userId) {
        log.debug("[JobStatsService] evicting userStats cache (all entries) after mutation for user {}", userId);
    }

    /**
     * Full cache flush – use when a bulk operation affects many users.
     */
    @CacheEvict(value = CacheConfig.USER_STATS, allEntries = true)
    public void evictAllUserStats() {
        log.info("[JobStatsService] full userStats cache eviction triggered");
    }
}
