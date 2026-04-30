package com.careerops.repository;

import com.careerops.model.SkillRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SkillRunRepository extends JpaRepository<SkillRun, UUID> {

    /**
     * TTL-aware cache lookup.
     * Returns the most recent run that is either not expired (expires_at IS NULL or in future).
     * Secure: always scoped to userId + userJobId.
     */
    @Query("""
        SELECT sr FROM SkillRun sr
        WHERE sr.userId = :userId
          AND sr.userJobId = :userJobId
          AND sr.skill = :skill
          AND (sr.expiresAt IS NULL OR sr.expiresAt > CURRENT_TIMESTAMP)
        ORDER BY sr.createdAt DESC
        LIMIT 1
        """)
    Optional<SkillRun> findValidCachedRun(
            @Param("userId") UUID userId,
            @Param("userJobId") UUID userJobId,
            @Param("skill") String skill);

    /**
     * Get most recent run regardless of expiry — used for display on reload.
     */
    Optional<SkillRun> findFirstByUserIdAndUserJobIdAndSkillOrderByCreatedAtDesc(
            UUID userId, UUID userJobId, String skill);

    /**
     * Get all runs for a job — used for run-all status + PDF generation.
     */
    List<SkillRun> findByUserIdAndUserJobIdOrderByCreatedAtDesc(UUID userId, UUID userJobId);

    /**
     * Check if a skill has ever been run for this job (for PDF download availability).
     */
    boolean existsByUserIdAndUserJobIdAndSkill(UUID userId, UUID userJobId, String skill);
}
