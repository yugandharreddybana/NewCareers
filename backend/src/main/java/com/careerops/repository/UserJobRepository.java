package com.careerops.repository;

import com.careerops.model.UserJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserJobRepository extends JpaRepository<UserJob, UUID> {

    List<UserJob> findByUserIdOrderByDeliveredAtDesc(UUID userId);
    Optional<UserJob> findByUserIdAndJobId(UUID userId, UUID jobId);
    Optional<UserJob> findByIdAndUserId(UUID id, UUID userId);

    @Query("select uj from UserJob uj where uj.userId = :uid and uj.kanbanColumn <> 'Discovered'")
    List<UserJob> findKanbanForUser(@Param("uid") UUID userId);

    long countByUserId(UUID userId);
    long countByUserIdAndKanbanColumn(UUID userId, String column);

    /**
     * Returns each distinct kanbanColumn + count in one query.
     * Each Object[] row is [kanbanColumn (String), count (Long)].
     */
    @Query("SELECT uj.kanbanColumn, COUNT(uj) FROM UserJob uj WHERE uj.userId = :uid GROUP BY uj.kanbanColumn")
    List<Object[]> countByColumnForUser(@Param("uid") UUID userId);

    /**
     * Average match% for the user in a single aggregation query.
     * Returns 0.0 when no rows exist.
     */
    @Query("SELECT COALESCE(AVG(uj.matchPercent), 0.0) FROM UserJob uj WHERE uj.userId = :uid AND uj.matchPercent IS NOT NULL")
    double avgMatchPercentForUser(@Param("uid") UUID userId);

    /**
     * Task 135 — AdminService.platformStats(): how many jobs were delivered
     * (i.e. UserJob rows created) since a given instant.
     */
    @Query("SELECT COUNT(uj) FROM UserJob uj WHERE uj.deliveredAt >= :since")
    long countDeliveredSince(@Param("since") Instant since);
}
