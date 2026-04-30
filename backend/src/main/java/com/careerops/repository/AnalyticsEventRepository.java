package com.careerops.repository;

import com.careerops.model.AnalyticsEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Section 5 — Task 45
 * Repository for analytics_events.
 * Provides:
 *   - countByUserIdAndEventTypeAndCreatedAtAfter  — for per-event-type weekly counts
 *   - findEventCountsByType                       — grouped event counts for skill usage chart
 *   - findFunnelStages                            — kanban column counts for the funnel chart
 */
@Repository
public interface AnalyticsEventRepository extends JpaRepository<AnalyticsEvent, UUID> {

    /**
     * Count events of a specific type for a user after a given timestamp.
     * Example: countByUserIdAndEventTypeAndCreatedAtAfter(userId, "skill_run_complete", weekAgo)
     */
    long countByUserIdAndEventTypeAndCreatedAtAfter(
            UUID userId, String eventType, Instant createdAt);

    /**
     * Group analytics_events by event_type for a user within a time window.
     * Returns rows of [eventType (String), count (Long)].
     */
    @Query(value = """
            SELECT event_type, COUNT(*) AS cnt
            FROM analytics_events
            WHERE user_id = :userId
              AND created_at >= :after
            GROUP BY event_type
            ORDER BY cnt DESC
            """, nativeQuery = true)
    List<Object[]> findEventCountsByType(
            @Param("userId") UUID userId,
            @Param("after")  Instant after);

    /**
     * Count user_jobs per kanban column — used for the application funnel chart.
     * Returns rows of [kanban_column (String), count (Long)].
     */
    @Query(value = """
            SELECT kanban_column, COUNT(*) AS cnt
            FROM user_jobs
            WHERE user_id = :userId
            GROUP BY kanban_column
            """, nativeQuery = true)
    List<Object[]> findFunnelStages(@Param("userId") UUID userId);
}
