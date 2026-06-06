package com.careerops.repository;

import com.careerops.model.UserConsent;
import com.careerops.model.UserConsent.ConsentType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserConsentRepository extends JpaRepository<UserConsent, UUID> {

    Optional<UserConsent> findFirstByUserIdAndConsentTypeOrderByAcceptedAtDesc(
            UUID userId, ConsentType consentType);

    List<UserConsent> findAllByUserIdOrderByAcceptedAtDesc(UUID userId);

    @Modifying
    @Transactional
    @Query(value = """
            DELETE FROM careerops.user_consents uc
            WHERE uc.user_id IN (
              SELECT u.id FROM careerops.users u
              WHERE u.deleted_at IS NOT NULL AND u.deleted_at < :cutoff
            )
            """, nativeQuery = true)
    int deleteForUsersDeletedBefore(@Param("cutoff") Instant cutoff);
}
