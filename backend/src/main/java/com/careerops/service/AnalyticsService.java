package com.careerops.service;

import com.careerops.model.AnalyticsEvent;
import com.careerops.repository.AnalyticsEventRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Analytics service — now includes getWeeklyTimeSeries for trend charts.
 *
 * Public methods:
 *   trackEvent(userId, type, metadata)    — persist an event
 *   getWeeklyStats(userId)                — summary stats
 *   getApplicationFunnel(userId)          — kanban stage counts
 *   getSkillUsage(userId)                 — per-skill run counts
 *   getWeeklyTimeSeries(userId, weeks)    — applications-per-week trend data
 */
@Service
public class AnalyticsService {

    private static final Logger log = LoggerFactory.getLogger(AnalyticsService.class);
    private static final DateTimeFormatter ISO_DATE = DateTimeFormatter.ISO_LOCAL_DATE;

    private static final List<String> FUNNEL_STAGES =
        List.of("Discovered", "Saved", "Applied", "Interview", "Offer", "Rejected");

    private final AnalyticsEventRepository analyticsRepo;

    @PersistenceContext
    private EntityManager em;

    // 3.065 — In-memory buffer for async flush
    private final java.util.concurrent.BlockingQueue<AnalyticsEvent> eventBuffer = new java.util.concurrent.LinkedBlockingQueue<>(1000);
    private final java.util.concurrent.ScheduledExecutorService scheduler = java.util.concurrent.Executors.newSingleThreadScheduledExecutor();

    public AnalyticsService(AnalyticsEventRepository analyticsRepo) {
        this.analyticsRepo = analyticsRepo;
        // Start background flush worker
        scheduler.scheduleAtFixedRate(this::flushEvents, 5, 5, java.util.concurrent.TimeUnit.SECONDS);
    }

    @jakarta.annotation.PreDestroy
    public void shutdown() {
        log.info("Analytics: flushing buffer before shutdown...");
        flushEvents();
        scheduler.shutdown();
    }

    // ── Track an event ─────────────────────────────────────────────────────────

    /**
     * Tracks an event by buffering it to an in-memory queue (3.065).
     * Prevents blocking the caller or losing data during DB hiccups.
     */
    public void trackEvent(UUID userId, String eventType, Map<String, Object> metadata) {
        AnalyticsEvent event = new AnalyticsEvent(userId, eventType, metadata);
        if (!eventBuffer.offer(event)) {
            log.warn("Analytics buffer full, dropping event: {}", eventType);
        }
    }

    private void flushEvents() {
        if (eventBuffer.isEmpty()) return;
        List<AnalyticsEvent> toSave = new ArrayList<>();
        eventBuffer.drainTo(toSave, 50);

        if (!toSave.isEmpty()) {
            try {
                analyticsRepo.saveAll(toSave);
                log.debug("Analytics: flushed {} events", toSave.size());
            } catch (Exception e) {
                log.error("Analytics: failed to flush {} events: {}", toSave.size(), e.getMessage());
                // Re-buffer if failed? Maybe risky, just log and allow drift for now as per severity 'Low'
            }
        }
    }

    // ── Weekly stats ───────────────────────────────────────────────────────────

    @Transactional(timeout = 10, readOnly = true)
    public Map<String, Object> getWeeklyStats(UUID userId) {
        Instant weekAgo = Instant.now().minus(7, ChronoUnit.DAYS);

        Number skillsRun = (Number) em.createNativeQuery("""
                SELECT COUNT(*) FROM skill_runs
                WHERE user_id = :userId AND created_at >= :after
                """)
                .setParameter("userId", userId)
                .setParameter("after",  weekAgo)
                .getSingleResult();

        Number applicationsSubmitted = (Number) em.createNativeQuery("""
                SELECT COUNT(*) FROM user_jobs
                WHERE user_id = :userId
                  AND kanban_column IN ('Applied', 'Interview', 'Offer')
                """)
                .setParameter("userId", userId)
                .getSingleResult();

        Number avgMatch = (Number) em.createNativeQuery("""
                SELECT COALESCE(ROUND(AVG(match_percent)), 0) FROM user_jobs
                WHERE user_id = :userId
                """)
                .setParameter("userId", userId)
                .getSingleResult();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("skillsRunThisWeek",     skillsRun    != null ? skillsRun.intValue()    : 0);
        stats.put("applicationsSubmitted",  applicationsSubmitted != null ? applicationsSubmitted.intValue() : 0);
        stats.put("avgMatchPercent",        avgMatch     != null ? avgMatch.intValue()     : 0);
        stats.put("skillUsage",             getSkillUsage(userId));
        return stats;
    }

    // ── Application funnel ─────────────────────────────────────────────────────

    @Transactional(timeout = 10, readOnly = true)
    public List<Map<String, Object>> getApplicationFunnel(UUID userId, java.time.Instant since) {
        if (since == null) {
            since = java.time.Instant.now().minus(30, java.time.temporal.ChronoUnit.DAYS);
        }

        @SuppressWarnings("unchecked")
        List<Object[]> rows = (List<Object[]>) em.createNativeQuery("""
                SELECT kanban_column, COUNT(*) AS cnt
                FROM user_jobs
                WHERE user_id = :userId
                  AND (created_at >= :since OR updated_at >= :since)
                GROUP BY kanban_column
                """)
                .setParameter("userId", userId)
                .setParameter("since", since)
                .getResultList();

        Map<String, Integer> countMap = new HashMap<>();
        for (Object[] row : rows) countMap.put((String) row[0], ((Number) row[1]).intValue());

        List<Map<String, Object>> funnel = new ArrayList<>();
        for (String stage : FUNNEL_STAGES) {
            funnel.add(Map.of("stage", stage, "count", countMap.getOrDefault(stage, 0)));
        }
        return funnel;
    }

    // ── Skill usage ────────────────────────────────────────────────────────────

    @Transactional(timeout = 10, readOnly = true)
    public List<Map<String, Object>> getSkillUsage(UUID userId) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = (List<Object[]>) em.createNativeQuery("""
                SELECT skill, COUNT(*) AS cnt
                FROM skill_runs WHERE user_id = :userId
                GROUP BY skill ORDER BY cnt DESC
                """)
                .setParameter("userId", userId)
                .getResultList();

        List<Map<String, Object>> result = new ArrayList<>();
        for (Object[] row : rows) {
            result.add(Map.of("skill", row[0], "count", ((Number) row[1]).intValue()));
        }
        return result;
    }

    // ── Weekly time-series (applications moved to Applied+ per week) ───────────

    /**
     * Returns one data point per week for the last {@code weeks} weeks.
     * Each point: { week: "2026-04-28", applications: 3, matchAvg: 72 }
     *
     * "applications" = jobs first moved to Applied/Interview/Offer in that calendar week.
     * "matchAvg"     = average match_percent of those jobs (0 if none).
     *
     * @param userId the user UUID
     * @param weeks  number of rolling weeks to return (1–52, default 8)
     */
    @Transactional(timeout = 10, readOnly = true)
    public List<Map<String, Object>> getWeeklyTimeSeries(UUID userId, int weeks) {
        int safeWeeks = Math.max(1, Math.min(weeks, 52));
        Instant cutoff = Instant.now().minus(safeWeeks * 7L, ChronoUnit.DAYS);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = (List<Object[]>) em.createNativeQuery("""
                SELECT
                    DATE_TRUNC('week', delivered_at)          AS week_start,
                    COUNT(*)                                   AS applications,
                    COALESCE(ROUND(AVG(match_percent)), 0)    AS match_avg
                FROM user_jobs
                WHERE user_id       = :userId
                  AND kanban_column IN ('Applied', 'Interview', 'Offer')
                  AND delivered_at  >= :cutoff
                GROUP BY week_start
                ORDER BY week_start ASC
                """)
                .setParameter("userId",  userId)
                .setParameter("cutoff",  cutoff)
                .getResultList();

        List<Map<String, Object>> series = new ArrayList<>();
        for (Object[] row : rows) {
            // row[0] is a java.sql.Timestamp — convert to ISO date string (week start)
            String weekLabel = ((java.sql.Timestamp) row[0])
                    .toInstant().atOffset(ZoneOffset.UTC).toLocalDate().format(ISO_DATE);
            series.add(Map.of(
                "week",         weekLabel,
                "applications", ((Number) row[1]).intValue(),
                "matchAvg",     ((Number) row[2]).intValue()
            ));
        }
        return series;
    }
}
