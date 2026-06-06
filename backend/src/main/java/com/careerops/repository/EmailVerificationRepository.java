package com.careerops.repository;

import com.careerops.model.EmailVerification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

public interface EmailVerificationRepository extends JpaRepository<EmailVerification, UUID> {

    Optional<EmailVerification> findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(String email);

    Optional<EmailVerification> findByIdAndEmail(UUID id, String email);

    @Modifying
    @Transactional
    @Query("UPDATE EmailVerification ev SET ev.consumedAt = CURRENT_TIMESTAMP "
            + "WHERE ev.email = :email AND ev.consumedAt IS NULL")
    void invalidateAllActiveForEmail(@Param("email") String email);

    @Modifying
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @Query("UPDATE EmailVerification ev SET ev.attempts = ev.attempts + 1 WHERE ev.id = :id")
    void incrementAttempts(@Param("id") UUID id);
}
