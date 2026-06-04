package com.careerops.repository;

import com.careerops.model.UserJob;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserJobRepository extends JpaRepository<UserJob, UUID> {

    // ─── Paginated card list (minimal fields via projection) ────────────────
    @Query("""
        SELECT uj.id            AS userJobId,
               j.id             AS jobId,
               j.title          AS title,
               j.company        AS company,
               j.location       AS location,
               j.jobType        AS jobType,
               j.source         AS source,
               uj.matchPercent  AS matchPercent,
               uj.status        AS status,
               uj.kanbanColumn  AS kanbanColumn,
               uj.isFavorite    AS isFavorite,
               uj.deliveredAt   AS deliveredAt
        FROM UserJob uj
        JOIN uj.job j
        WHERE uj.userId = :userId
        ORDER BY uj.deliveredAt DESC
        """)
    Page<JobCardProjection> findCardsByUserId(@Param("userId") UUID userId, Pageable pageable);

    // ─── Filtered by kanban column ───────────────────────────────────────────
    @Query("""
        SELECT uj.id            AS userJobId,
               j.id             AS jobId,
               j.title          AS title,
               j.company        AS company,
               j.location       AS location,
               j.jobType        AS jobType,
               j.source         AS source,
               uj.matchPercent  AS matchPercent,
               uj.status        AS status,
               uj.kanbanColumn  AS kanbanColumn,
               uj.isFavorite    AS isFavorite,
               uj.deliveredAt   AS deliveredAt
        FROM UserJob uj
        JOIN uj.job j
        WHERE uj.userId = :userId
          AND uj.kanbanColumn = :column
        ORDER BY uj.deliveredAt DESC
        """)
    Page<JobCardProjection> findCardsByUserIdAndColumn(
            @Param("userId") UUID userId,
            @Param("column") String column,
            Pageable pageable);

    // ─── Favorites only ──────────────────────────────────────────────────────
    @Query("""
        SELECT uj.id            AS userJobId,
               j.id             AS jobId,
               j.title          AS title,
               j.company        AS company,
               j.location       AS location,
               j.jobType        AS jobType,
               j.source         AS source,
               uj.matchPercent  AS matchPercent,
               uj.status        AS status,
               uj.kanbanColumn  AS kanbanColumn,
               uj.isFavorite    AS isFavorite,
               uj.deliveredAt   AS deliveredAt
        FROM UserJob uj
        JOIN uj.job j
        WHERE uj.userId = :userId
          AND uj.isFavorite = true
        ORDER BY uj.matchPercent DESC NULLS LAST
        """)
    Page<JobCardProjection> findFavoriteCardsByUserId(
            @Param("userId") UUID userId,
            Pageable pageable);

    // ─── Stats queries (cheap aggregates — cached at service layer) ──────────
    @Query("SELECT COUNT(uj) FROM UserJob uj WHERE uj.userId = :userId")
    long countByUserId(@Param("userId") UUID userId);

    @Query("SELECT COUNT(uj) FROM UserJob uj WHERE uj.userId = :userId AND uj.kanbanColumn = :col")
    long countByUserIdAndColumn(@Param("userId") UUID userId, @Param("col") String col);

    @Query("SELECT COUNT(uj) FROM UserJob uj WHERE uj.userId = :userId AND uj.isFavorite = true")
    long countFavoritesByUserId(@Param("userId") UUID userId);

    @Query("SELECT AVG(uj.matchPercent) FROM UserJob uj WHERE uj.userId = :userId AND uj.matchPercent IS NOT NULL")
    Double avgMatchPercentByUserId(@Param("userId") UUID userId);

    // ─── Column distribution for Kanban header badges ───────────────────────
    @Query("""
        SELECT uj.kanbanColumn AS col, COUNT(uj) AS cnt
        FROM UserJob uj
        WHERE uj.userId = :userId
        GROUP BY uj.kanbanColumn
        """)
    List<Object[]> countByUserIdGroupByColumn(@Param("userId") UUID userId);

    // ─── Single record lookups ───────────────────────────────────────────────
    Optional<UserJob> findByUserIdAndJobId(UUID userId, UUID jobId);

    boolean existsByUserIdAndJobId(UUID userId, UUID jobId);
}
