package com.careerops.repository;

import com.careerops.model.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;
import java.util.List;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {
    Optional<RefreshToken> findByTokenHash(String tokenHash);
    List<RefreshToken> findByUserIdOrderByLastUsedAtDesc(UUID userId);
    void deleteByUserId(UUID userId);
    void deleteByTokenHash(String tokenHash);

    @org.springframework.transaction.annotation.Transactional
    int deleteByExpiresAtBefore(java.time.Instant now);
}
