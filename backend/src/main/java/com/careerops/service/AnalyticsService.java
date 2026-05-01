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

    public AnalyticsService(AnalyticsEventRepository analyticsRepo) {
        this.analyticsRepo = analyticsRepo;
    }

    // ── Track an event ─────────────────────────────────────────────────────────

    @Transactional
    public void trackEvent(UUID userId, String eventType, Map<String, Object> metadata) {
        try {
            analyticsRepo.save(new AnalyticsEvent(userId, eventType, metadata));
        } catch (Exception e) {
            log.warn("Analytics: failed to track event {} — {}", eventType, e.getMessage());
        }
    }

    // ── Weekly stats ───────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
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

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getApplicationFunnel(UUID userId) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = (List<Object[]>) em.createNativeQuery("""
                SELECT kanban_column, COUNT(*) AS cnt
                FROM user_jobs WHERE user_id = :userId
                GROUP BY kanban_column
                """)
                .setParameter("userId", userId)
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

    @Transactional(readOnly = true)
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
    @Transactional(readOnly = true)
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
