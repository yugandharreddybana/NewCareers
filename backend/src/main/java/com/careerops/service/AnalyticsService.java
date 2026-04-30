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
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Section 5 — Task 46
 *
 * Analytics service.
 * Data sources:
 *   - analytics_events  — for event-based counts (skill_run_complete, etc.)
 *   - skill_runs        — for weekly skill run count
 *   - user_jobs         — for funnel stages, avg match %, applications submitted
 *
 * Public methods:
 *   trackEvent(userId, type, metadata)  — persist an event
 *   getWeeklyStats(userId)              — summary stats for Dashboard stats row
 *   getApplicationFunnel(userId)        — kanban stage counts for funnel chart
 *   getSkillUsage(userId)               — per-skill run counts for usage chart
 */
@Service
public class AnalyticsService {

    private static final Logger log = LoggerFactory.getLogger(AnalyticsService.class);

    // Ordered funnel stages — must match kanban column names exactly
    private static final List<String> FUNNEL_STAGES =
        List.of("Discovered", "Saved", "Applied", "Interview", "Offer", "Rejected");

    private final AnalyticsEventRepository analyticsRepo;

    @PersistenceContext
    private EntityManager em;

    public AnalyticsService(AnalyticsEventRepository analyticsRepo) {
        this.analyticsRepo = analyticsRepo;
    }

    // ── Track an event ─────────────────────────────────────────────────────────

    /**
     * Persist a user activity event to analytics_events.
     * Called from SkillService, KanbanService, etc.
     * eventType conventions: "skill_run_complete", "job_viewed", "application_submitted"
     */
    @Transactional
    public void trackEvent(UUID userId, String eventType, Map<String, Object> metadata) {
        try {
            analyticsRepo.save(new AnalyticsEvent(userId, eventType, metadata));
            log.debug("Analytics: tracked {} for user {}", eventType, userId);
        } catch (Exception e) {
            // Never let analytics tracking break the main flow
            log.warn("Analytics: failed to track event {} — {}", eventType, e.getMessage());
        }
    }

    // ── Weekly stats (Dashboard stats row + Analytics page header) ─────────────

    /**
     * Returns a map with:
     *   skillsRunThisWeek    — count of skill_runs in the last 7 days
     *   applicationsSubmitted — count of user_jobs in Applied/Interview/Offer columns
     *   avgMatchPercent      — average match_percent across all user's jobs (0-100)
     *   skillUsage           — list of { skill, count } for the usage bar chart
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getWeeklyStats(UUID userId) {
        Instant weekAgo = Instant.now().minus(7, ChronoUnit.DAYS);

        // Skills run this week — from skill_runs table
        Number skillsRun = (Number) em.createNativeQuery("""
                SELECT COUNT(*) FROM skill_runs
                WHERE user_id = :userId
                  AND created_at >= :after
                """)
                .setParameter("userId", userId)
                .setParameter("after",  weekAgo)
                .getSingleResult();

        // Applications submitted — kanban columns that represent active applications
        Number applicationsSubmitted = (Number) em.createNativeQuery("""
                SELECT COUNT(*) FROM user_jobs
                WHERE user_id = :userId
                  AND kanban_column IN ('Applied', 'Interview', 'Offer')
                """)
                .setParameter("userId", userId)
                .getSingleResult();

        // Average match percent across all the user's jobs
        Number avgMatch = (Number) em.createNativeQuery("""
                SELECT COALESCE(ROUND(AVG(match_percent)), 0) FROM user_jobs
                WHERE user_id = :userId
                """)
                .setParameter("userId", userId)
                .getSingleResult();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("skillsRunThisWeek",     skillsRun    != null ? skillsRun.intValue()    : 0);
        stats.put("applicationsSubmitted",  applicationsSubmitted != null
                                                ? applicationsSubmitted.intValue() : 0);
        stats.put("avgMatchPercent",        avgMatch     != null ? avgMatch.intValue()     : 0);
        stats.put("skillUsage",             getSkillUsage(userId));
        return stats;
    }

    // ── Application funnel (ordered by funnel stage) ───────────────────────────

    /**
     * Returns ordered list of { stage, count } for the funnel bar chart.
     * All 6 stages always present (zero-filled if no jobs in that stage).
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getApplicationFunnel(UUID userId) {
        // Build a count map from DB result
        @SuppressWarnings("unchecked")
        List<Object[]> rows = (List<Object[]>) em.createNativeQuery("""
                SELECT kanban_column, COUNT(*) AS cnt
                FROM user_jobs
                WHERE user_id = :userId
                GROUP BY kanban_column
                """)
                .setParameter("userId", userId)
                .getResultList();

        Map<String, Integer> countMap = new HashMap<>();
        for (Object[] row : rows) {
            countMap.put((String) row[0], ((Number) row[1]).intValue());
        }

        // Return in funnel order, zero-filling missing stages
        List<Map<String, Object>> funnel = new ArrayList<>();
        for (String stage : FUNNEL_STAGES) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("stage", stage);
            item.put("count", countMap.getOrDefault(stage, 0));
            funnel.add(item);
        }
        return funnel;
    }

    // ── Skill usage (per-skill run counts) ─────────────────────────────────────

    /**
     * Returns list of { skill, count } ordered by most-used first.
     * Queried from skill_runs table — source of truth for skill activity.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getSkillUsage(UUID userId) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = (List<Object[]>) em.createNativeQuery("""
                SELECT skill, COUNT(*) AS cnt
                FROM skill_runs
                WHERE user_id = :userId
                GROUP BY skill
                ORDER BY cnt DESC
                """)
                .setParameter("userId", userId)
                .getResultList();

        List<Map<String, Object>> result = new ArrayList<>();
        for (Object[] row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("skill", row[0]);
            item.put("count", ((Number) row[1]).intValue());
            result.add(item);
        }
        return result;
    }
}
