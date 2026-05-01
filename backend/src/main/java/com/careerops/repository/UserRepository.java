package com.careerops.repository;

import com.careerops.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    boolean existsByEmail(String email);
    boolean existsByUsername(String username);
    Optional<User> findByEmail(String email);

    /** Task 118 — look up a user by their hashed refresh token. */
    @Query("SELECT u FROM User u WHERE u.refreshToken = :hash")
    Optional<User> findByRefreshToken(String hash);

    /**
     * Task 124 — Bulk-wipe all expired refresh tokens in a single UPDATE.
     * Called nightly by CronJobService at 02:00 Dublin time.
     * Returns the number of rows purged.
     */
    @Modifying
    @Transactional
    @Query("UPDATE User u SET u.refreshToken = NULL, u.refreshTokenExpiresAt = NULL "
         + "WHERE u.refreshTokenExpiresAt IS NOT NULL AND u.refreshTokenExpiresAt < :now")
    int purgeExpiredRefreshTokens(Instant now);
}
