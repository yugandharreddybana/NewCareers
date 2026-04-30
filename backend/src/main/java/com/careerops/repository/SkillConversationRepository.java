package com.careerops.repository;

import com.careerops.model.SkillConversation;
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

@Repository
public interface SkillConversationRepository extends JpaRepository<SkillConversation, UUID> {

    /**
     * Secure fetch — always includes userId to prevent cross-user access.
     */
    Optional<SkillConversation> findByIdAndUserId(UUID id, UUID userId);

    /**
     * Find all pending conversations for a user (should rarely be more than a few).
     */
    List<SkillConversation> findByUserIdAndStatus(UUID userId, String status);

    /**
     * Find pending conversation for a specific user+skill+job combo.
     * Used to detect if a skill is already mid-conversation before starting a new one.
     */
    Optional<SkillConversation> findByUserIdAndSkillAndUserJobIdAndStatus(
            UUID userId, String skill, UUID userJobId, String status);

    /**
     * Find all expired pending conversations for cleanup.
     */
    @Query("SELECT sc FROM SkillConversation sc WHERE sc.expiresAt < :now AND sc.status = 'pending_answer'")
    List<SkillConversation> findAllExpired(@Param("now") Instant now);

    /**
     * Bulk delete expired conversations — called by cleanup cron.
     */
    @Modifying
    @Transactional
    @Query("DELETE FROM SkillConversation sc WHERE sc.expiresAt < :now AND sc.status = 'pending_answer'")
    int deleteAllExpired(@Param("now") Instant now);
}
