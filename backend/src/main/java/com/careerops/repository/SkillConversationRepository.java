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
     * Fetch a conversation by ID, scoped to the requesting user.
     * ALWAYS use this overload — never fetch by ID alone (prevents cross-user access).
     */
    Optional<SkillConversation> findByIdAndUserId(UUID id, UUID userId);

    /** List all conversations for a user with a given status. Used for diagnostics. */
    List<SkillConversation> findByUserIdAndStatus(UUID userId, String status);

    /** Find all conversations that have passed their expiry time (for cleanup job). */
    List<SkillConversation> findAllByExpiresAtBefore(Instant now);

    /**
     * Delete all expired conversations in a single query.
     * Called every 15 minutes by SkillConversationCleanupJob.
     * Returns count of deleted rows (logged at DEBUG level).
     */
    @Modifying
    @Transactional
    @Query("DELETE FROM SkillConversation sc WHERE sc.expiresAt < :now")
    int deleteByExpiresAtBefore(@Param("now") Instant now);
}
