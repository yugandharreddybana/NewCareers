package com.careerops.repository;

import com.careerops.model.PasswordReset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface PasswordResetRepository extends JpaRepository<PasswordReset, UUID> {
    Optional<PasswordReset> findFirstByUserIdAndUsedFalseOrderByCreatedAtDesc(UUID userId);
    Optional<PasswordReset> findFirstByUserIdOrderByCreatedAtDesc(UUID userId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("UPDATE PasswordReset pr SET pr.used = true WHERE pr.userId = :userId AND pr.used = false")
    void invalidateAllForUserId(@org.springframework.data.repository.query.Param("userId") UUID userId);

    long countByUserIdAndCreatedAtAfter(UUID userId, java.time.Instant since);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    @org.springframework.data.jpa.repository.Query("UPDATE PasswordReset pr SET pr.attempts = pr.attempts + 1 WHERE pr.id = :id")
    void incrementAttempts(@org.springframework.data.repository.query.Param("id") UUID id);

    @org.springframework.data.jpa.repository.Modifying
    @Transactional
    int deleteByCreatedAtBefore(Instant cutoff);
}
