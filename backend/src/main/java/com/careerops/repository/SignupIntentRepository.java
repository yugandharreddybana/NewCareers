package com.careerops.repository;

import com.careerops.model.SignupIntent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface SignupIntentRepository extends JpaRepository<SignupIntent, UUID> {

    Optional<SignupIntent> findByIdAndEmail(UUID id, String email);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE SignupIntent si SET si.consumedAt = :consumedAt
            WHERE si.id = :id AND si.email = :email
              AND si.consumedAt IS NULL AND si.expiresAt > :now
            """)
    int consumeIfActive(
            @Param("id") UUID id,
            @Param("email") String email,
            @Param("consumedAt") Instant consumedAt,
            @Param("now") Instant now);
}
