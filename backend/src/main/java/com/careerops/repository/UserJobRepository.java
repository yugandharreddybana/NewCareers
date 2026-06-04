package com.careerops.repository;

import com.careerops.dto.JobCardProjection;
import com.careerops.model.UserJob;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Repository for {@link UserJob} entities.
 *
 * Batch 4 additions:
 *  – Paginated card projections (no N+1, no heavy columns)
 *  – Kanban board projection
 *  – Stats aggregate queries used by {@link com.careerops.service.JobStatsService}
 *  – Activity-period count helpers for dashboard charts
 */
@Repository
public interface UserJobRepository extends JpaRepository<UserJob, UUID>, JpaSpecificationExecutor<UserJob> {

    // ── Paginated card list (projection – no N+1, no heavy columns) ──────────
    /**
     * Returns a page of lightweight card projections for the jobs list UI.
     * Uses a plain JPQL join (not EntityGraph) so Spring Data can apply
     * the projection at the SQL level – only the listed columns are fetched.
     */
    @Query("""
            SELECT uj.id            AS id,
                   uj.userId        AS userId,
                   j.title          AS title,
                   j.company        AS company,
                   j.location       AS location,
                   j.source         AS source,
                   j.employmentType AS employmentType,
                   uj.kanbanColumn  AS kanbanColumn,
                   uj.matchPercent  AS matchPercent,
                   uj.isFavorite    AS isFavorite,
                   uj.isNew         AS isNew,
                   uj.deliveredAt   AS deliveredAt,
                   j.salaryCurrency AS salaryCurrency,
                   j.salaryMin      AS salaryMin,
                   j.salaryMax      AS salaryMax
            FROM UserJob uj
            JOIN uj.job j
            WHERE uj.userId = :userId
              AND uj.deletedAt IS NULL
            ORDER BY uj.deliveredAt DESC
            """)
    Page<JobCardProjection> findCardsByUserId(@Param("userId") UUID userId, Pageable pageable);

    // ── Filtered by kanban column ─────────────────────────────────────────────
    @Query("""
            SELECT uj.id            AS id,
                   uj.userId        AS userId,
                   j.title          AS title,
                   j.company        AS company,
                   j.location       AS location,
                   j.source         AS source,
                   j.employmentType AS employmentType,
                   uj.kanbanColumn  AS kanbanColumn,
                   uj.matchPercent  AS matchPercent,
                   uj.isFavorite    AS isFavorite,
                   uj.isNew         AS isNew,
                   uj.deliveredAt   AS deliveredAt,
                   j.salaryCurrency AS salaryCurrency,
                   j.salaryMin      AS salaryMin,
                   j.salaryMax      AS salaryMax
            FROM UserJob uj
            JOIN uj.job j
            WHERE uj.userId = :userId
              AND uj.kanbanColumn = :column
              AND uj.deletedAt IS NULL
            ORDER BY uj.deliveredAt DESC
            """)
    Page<JobCardProjection> findCardsByUserIdAndColumn(
            @Param("userId") UUID userId,
            @Param("column") String column,
            Pageable pageable);

    // ── Kanban board (card projection, no 'Discovered' column) ───────────────
    @Query("""
            SELECT uj.id            AS id,
                   uj.userId        AS userId,
                   j.title          AS title,
                   j.company        AS company,
                   j.location       AS location,
                   j.source         AS source,
                   j.employmentType AS employmentType,
                   uj.kanbanColumn  AS kanbanColumn,
                   uj.matchPercent  AS matchPercent,
                   uj.isFavorite    AS isFavorite,
                   uj.isNew         AS isNew,
                   uj.deliveredAt   AS deliveredAt,
                   j.salaryCurrency AS salaryCurrency,
                   j.salaryMin      AS salaryMin,
                   j.salaryMax      AS salaryMax
            FROM UserJob uj
            JOIN uj.job j
            WHERE uj.userId = :userId
              AND uj.kanbanColumn <> 'Discovered'
              AND uj.deletedAt IS NULL
            ORDER BY uj.deliveredAt DESC
            """)
    List<JobCardProjection> findKanbanCardsForUser(@Param("userId") UUID userId);

    // ── Favorites only ────────────────────────────────────────────────────────
    @Query("""
            SELECT uj.id            AS id,
                   uj.userId        AS userId,
                   j.title          AS title,
                   j.company        AS company,
                   j.location       AS location,
                   j.source         AS source,
                   j.employmentType AS employmentType,
                   uj.kanbanColumn  AS kanbanColumn,
                   uj.matchPercent  AS matchPercent,
                   uj.isFavorite    AS isFavorite,
                   uj.isNew         AS isNew,
                   uj.deliveredAt   AS deliveredAt,
                   j.salaryCurrency AS salaryCurrency,
                   j.salaryMin      AS salaryMin,
                   j.salaryMax      AS salaryMax
            FROM UserJob uj
            JOIN uj.job j
            WHERE uj.userId = :userId
              AND uj.isFavorite = true
              AND uj.deletedAt IS NULL
            ORDER BY uj.matchPercent DESC NULLS LAST
            """)
    Page<JobCardProjection> findFavoriteCardsByUserId(
            @Param("userId") UUID userId,
            Pageable pageable);

    // ── Full entity – only used internally (e.g. update / detail) ────────────
    @EntityGraph(attributePaths = {"job"})
    Optional<UserJob> findByIdAndUserId(UUID id, UUID userId);

    @EntityGraph(attributePaths = {"job"})
    Optional<UserJob> findByUserIdAndJobId(UUID userId, UUID jobId);

    boolean existsByUserIdAndJobId(UUID userId, UUID jobId);

    // ── Lightweight helpers (no entity load) ─────────────────────────────────
    @Query("SELECT uj.jobId FROM UserJob uj WHERE uj.userId = :userId")
    Set<UUID> findJobIdsByUserId(@Param("userId") UUID userId);

    // ── Stats aggregate queries (used by JobStatsService – cached) ───────────
    @Query("SELECT COUNT(uj) FROM UserJob uj WHERE uj.userId = :userId")
    long countByUserId(@Param("userId") UUID userId);

    @Query("SELECT COUNT(uj) FROM UserJob uj WHERE uj.userId = :userId AND uj.kanbanColumn = :col")
    long countByUserIdAndColumn(@Param("userId") UUID userId, @Param("col") String col);

    @Query("SELECT COUNT(uj) FROM UserJob uj WHERE uj.userId = :userId AND uj.isFavorite = true")
    long countFavoritesByUserId(@Param("userId") UUID userId);

    @Query("SELECT COALESCE(AVG(uj.matchPercent), 0.0) FROM UserJob uj WHERE uj.userId = :userId AND uj.matchPercent IS NOT NULL")
    double avgMatchPercentForUser(@Param("userId") UUID userId);

    @Query("SELECT COALESCE(AVG(uj.matchPercent), 0.0) FROM UserJob uj WHERE uj.userId = :userId AND uj.matchPercent IS NOT NULL")
    Double avgMatchPercentByUserId(@Param("userId") UUID userId);

    long countByUserIdAndScoreBreakdownIsNotNull(UUID userId);

    // ── Kanban column distribution ────────────────────────────────────────────
    @Query("SELECT uj.kanbanColumn, COUNT(uj) FROM UserJob uj WHERE uj.userId = :userId GROUP BY uj.kanbanColumn")
    List<Object[]> countByColumnForUser(@Param("userId") UUID userId);

    @Query("""
            SELECT uj.kanbanColumn AS col, COUNT(uj) AS cnt
            FROM UserJob uj
            WHERE uj.userId = :userId
            GROUP BY uj.kanbanColumn
            """)
    List<Object[]> countByUserIdGroupByColumn(@Param("userId") UUID userId);

    // ── Activity-period queries (used by JobStatsService.getActivityStats) ────
    @Query("SELECT COUNT(uj) FROM UserJob uj WHERE uj.userId = :userId AND uj.deliveredAt >= :since")
    long countByUserIdAndDeliveredAtAfter(@Param("userId") UUID userId, @Param("since") Instant since);

    @Query("SELECT COUNT(uj) FROM UserJob uj WHERE uj.userId = :userId AND uj.kanbanColumn = :col AND uj.deliveredAt >= :since")
    long countByUserIdAndKanbanColumnAndDeliveredAtAfter(
            @Param("userId") UUID userId,
            @Param("col") String col,
            @Param("since") Instant since);

    @Query("SELECT COUNT(uj) FROM UserJob uj WHERE uj.deliveredAt >= :since")
    long countDeliveredSince(@Param("since") Instant since);

    // ── Deprecated full-entity list (kept for internal batch/admin only) ──────
    /**
     * @deprecated Use {@link #findCardsByUserId(UUID, Pageable)} for list endpoints.
     * Kept for internal batch/admin usage only.
     */
    @Deprecated
    @EntityGraph(attributePaths = {"job"})
    Page<UserJob> findByUserIdOrderByDeliveredAtDesc(UUID userId, Pageable pageable);
}
