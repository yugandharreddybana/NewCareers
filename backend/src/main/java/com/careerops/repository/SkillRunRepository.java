package com.careerops.repository;

import com.careerops.model.SkillRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Repository
public interface SkillRunRepository extends JpaRepository<SkillRun, UUID> {

    /**
     * TTL-aware cache lookup.
     * Returns the most recent non-expired run (expires_at must be set and in the future).
     * Secure: always scoped to userId + userJobId.
     */
    @Query("""
        SELECT sr FROM SkillRun sr
        WHERE sr.userId = :userId
          AND sr.userJobId = :userJobId
          AND sr.skill = :skill
          AND sr.expiresAt IS NOT NULL
          AND sr.expiresAt > :now
        ORDER BY sr.createdAt DESC
        LIMIT 1
        """)
    Optional<SkillRun> findValidCachedRun(
            @Param("userId") UUID userId,
            @Param("userJobId") UUID userJobId,
            @Param("skill") String skill,
            @Param("now") Instant now);

    /**
     * Get most recent run regardless of expiry — used for display on reload.
     */
    Optional<SkillRun> findFirstByUserIdAndUserJobIdAndSkillOrderByCreatedAtDesc(
            UUID userId, UUID userJobId, String skill);

    List<SkillRun> findByUserIdAndUserJobIdAndSkillOrderByCreatedAtDesc(
            UUID userId, UUID userJobId, String skill, Pageable pageable);

    /**
     * Get all runs for a job — used for run-all status + PDF generation.
     */
    List<SkillRun> findAllByUserIdAndUserJobIdOrderByCreatedAtDesc(UUID userId, UUID userJobId);

    Page<SkillRun> findByUserIdAndUserJobIdOrderByCreatedAtDesc(UUID userId, UUID userJobId, Pageable pageable);

    /**
     * Used for 'upsert' logic to prevent row accumulation (3.058).
     */
    void deleteByUserIdAndUserJobIdAndSkill(UUID userId, UUID userJobId, String skill);

    /**
     * Check if a skill has ever been run for this job (for PDF download availability).
     */
    boolean existsByUserIdAndUserJobIdAndSkill(UUID userId, UUID userJobId, String skill);

    @Query("""
        SELECT DISTINCT sr.skill FROM SkillRun sr
        WHERE sr.userId = :userId AND sr.userJobId = :userJobId
        ORDER BY sr.skill ASC
        """)
    List<String> findDistinctSkillsByUserIdAndUserJobId(
            @Param("userId") UUID userId,
            @Param("userJobId") UUID userJobId);

    /**
     * Nightly cleanup for expired results (3.058).
     */
    @Modifying
    @Transactional
    @Query("DELETE FROM SkillRun sr WHERE sr.expiresAt < :now")
    int deleteAllExpired(@Param("now") Instant now);

    long countByUserIdAndCreatedAtAfter(UUID userId, Instant since);
}
