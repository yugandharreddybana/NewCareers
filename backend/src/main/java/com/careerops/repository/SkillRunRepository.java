package com.careerops.repository;

import com.careerops.model.SkillRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SkillRunRepository extends JpaRepository<SkillRun, UUID> {

    /**
     * TTL-aware cache lookup.
     *
     * Returns the most recent SkillRun for this user+job+skill combination IF:
     *   - expiresAt is NULL (never expires), OR
     *   - expiresAt is in the future (cache is still valid)
     *
     * This is the ONLY cache lookup method that should be used in SkillService.
     * It prevents serving stale cached results after the TTL has passed.
     */
    @Query("""
        SELECT sr FROM SkillRun sr
        WHERE sr.userId    = :userId
          AND sr.userJobId = :userJobId
          AND sr.skill     = :skill
          AND (sr.expiresAt IS NULL OR sr.expiresAt > :now)
        ORDER BY sr.createdAt DESC
        LIMIT 1
        """)
    Optional<SkillRun> findValidCache(
        @Param("userId")    UUID    userId,
        @Param("userJobId") UUID    userJobId,
        @Param("skill")     String  skill,
        @Param("now")       Instant now
    );

    /**
     * Fetch the most recent run regardless of TTL.
     * Used for PDF download (we always serve the latest, even if "stale" for re-run purposes).
     */
    Optional<SkillRun> findFirstByUserIdAndUserJobIdAndSkillOrderByCreatedAtDesc(
        UUID userId, UUID userJobId, String skill
    );

    /**
     * Fetch the most recent run for queue-level skills (triage/compare) where userJobId is null.
     * Scoped to userId only.
     */
    Optional<SkillRun> findFirstByUserIdAndSkillOrderByCreatedAtDesc(
        UUID userId, String skill
    );
}
