package com.careerops.repository;

import com.careerops.model.UserSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserSessionRepository extends JpaRepository<UserSession, UUID> {
    List<UserSession> findByUserIdAndRevokedFalseOrderByCreatedAtDesc(UUID userId);
    Optional<UserSession> findBySessionToken(String token);

    @Modifying
    @Transactional
    @Query("UPDATE UserSession s SET s.revoked = true, s.revokedAt = CURRENT_TIMESTAMP WHERE s.userId = :userId AND s.revoked = false")
    int revokeAllByUserId(@Param("userId") UUID userId);
}
