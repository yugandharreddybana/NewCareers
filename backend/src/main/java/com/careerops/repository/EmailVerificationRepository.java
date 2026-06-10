package com.careerops.repository;

import com.careerops.model.EmailVerification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface EmailVerificationRepository extends JpaRepository<EmailVerification, UUID> {

    Optional<EmailVerification> findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(String email);

    Optional<EmailVerification> findByIdAndEmail(UUID id, String email);

    @Modifying
    @Transactional
    @Query("UPDATE EmailVerification ev SET ev.consumedAt = :consumedAt "
            + "WHERE ev.email = :email AND ev.consumedAt IS NULL")
    void invalidateAllActiveForEmail(@Param("email") String email, @Param("consumedAt") Instant consumedAt);

    @Modifying
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @Query("UPDATE EmailVerification ev SET ev.attempts = ev.attempts + 1 WHERE ev.id = :id")
    void incrementAttempts(@Param("id") UUID id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE EmailVerification ev SET ev.consumedAt = :consumedAt
            WHERE ev.id = :id AND ev.email = :email
              AND ev.consumedAt IS NULL
              AND ev.captchaVerifiedAt IS NOT NULL
              AND ev.captchaVerifiedAt >= :captchaValidSince
              AND ev.createdAt >= :sessionStartedAfter
            """)
    int consumeForSignupIfEligible(
            @Param("id") UUID id,
            @Param("email") String email,
            @Param("consumedAt") Instant consumedAt,
            @Param("captchaValidSince") Instant captchaValidSince,
            @Param("sessionStartedAfter") Instant sessionStartedAfter);
}
