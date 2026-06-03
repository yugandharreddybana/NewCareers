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

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

public interface UserJobRepository extends JpaRepository<UserJob, UUID>, JpaSpecificationExecutor<UserJob> {

    // ── Paginated card list (projection – no N+1, no heavy columns) ──────────
    /**
     * Returns a page of lightweight card projections for the jobs list UI.
     * The JPQL JOIN FETCH on j (job) is expressed via @EntityGraph so the
     * join happens in one query, and the interface projection avoids loading
     * score_breakdown / full description.
     */
    @Query("""
        SELECT uj.id           AS id,
               uj.userId       AS userId,
               j.title         AS title,
               j.company       AS company,
               j.location      AS location,
               j.source        AS source,
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

    // ── Kanban board (card projection, no 'Discovered' column) ───────────────
    @Query("""
        SELECT uj.id           AS id,
               uj.userId       AS userId,
               j.title         AS title,
               j.company       AS company,
               j.location      AS location,
               j.source        AS source,
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
        WHERE uj.userId = :uid
          AND uj.kanbanColumn <> 'Discovered'
          AND uj.deletedAt IS NULL
        ORDER BY uj.deliveredAt DESC
        """)
    List<JobCardProjection> findKanbanCardsForUser(@Param("uid") UUID userId);

    // ── Full entity – only used internally (e.g. update / detail) ────────────
    @EntityGraph(attributePaths = {"job"})
    Optional<UserJob> findByIdAndUserId(UUID id, UUID userId);

    @EntityGraph(attributePaths = {"job"})
    Optional<UserJob> findByUserIdAndJobId(UUID userId, UUID jobId);

    // ── Lightweight helpers (no entity load) ─────────────────────────────────
    @Query("SELECT uj.jobId FROM UserJob uj WHERE uj.userId = :userId")
    Set<UUID> findJobIdsByUserId(@Param("userId") UUID userId);

    long countByUserId(UUID userId);
    long countByUserIdAndKanbanColumn(UUID userId, String column);

    @Query("SELECT uj.kanbanColumn, COUNT(uj) FROM UserJob uj WHERE uj.userId = :uid GROUP BY uj.kanbanColumn")
    List<Object[]> countByColumnForUser(@Param("uid") UUID userId);

    @Query("SELECT COALESCE(AVG(uj.matchPercent), 0.0) FROM UserJob uj WHERE uj.userId = :uid AND uj.matchPercent IS NOT NULL")
    double avgMatchPercentForUser(@Param("uid") UUID userId);

    @Query("SELECT COUNT(uj) FROM UserJob uj WHERE uj.deliveredAt >= :since")
    long countDeliveredSince(@Param("since") Instant since);

    long countByUserIdAndDeliveredAtAfter(UUID userId, Instant since);

    long countByUserIdAndKanbanColumnAndDeliveredAtAfter(UUID userId, String column, Instant since);

    List<UserJob> findTop3ByUserIdAndDeliveredAtAfterAndMatchPercentIsNotNullOrderByMatchPercentDesc(UUID userId, Instant since);

    long countByUserIdAndScoreBreakdownIsNotNull(UUID userId);

    /**
     * @deprecated Use {@link #findCardsByUserId(UUID, Pageable)} for list endpoints.
     * Kept for internal batch/admin usage only.
     */
    @Deprecated
    @EntityGraph(attributePaths = {"job"})
    Page<UserJob> findByUserIdOrderByDeliveredAtDesc(UUID userId, Pageable pageable);
}
