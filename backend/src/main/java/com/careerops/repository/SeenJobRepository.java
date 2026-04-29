package com.careerops.repository;

import com.careerops.model.SeenJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

public interface SeenJobRepository extends JpaRepository<SeenJob, SeenJob.PK> {
    boolean existsByUserIdAndFingerprint(UUID userId, String fingerprint);

    /**
     * Deletes all seen_jobs rows older than the given cutoff timestamp.
     * Used by the daily cron to prevent the table growing unboundedly.
     */
    @Modifying
    @Transactional
    @Query("DELETE FROM SeenJob s WHERE s.seenAt < :cutoff")
    int deleteBySeenAtBefore(@Param("cutoff") Instant cutoff);
}
