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

    @Query("SELECT CASE WHEN COUNT(u) > 0 THEN true ELSE false END FROM User u WHERE lower(u.email) = lower(:email)")
    boolean existsByEmail(@org.springframework.data.repository.query.Param("email") String email);

    boolean existsByUsername(String username);

    @Query("SELECT u FROM User u WHERE lower(u.email) = lower(:email)")
    Optional<User> findByEmail(@org.springframework.data.repository.query.Param("email") String email);

    @Query(value = "SELECT * FROM careerops.users WHERE id = :id AND deleted_at IS NULL FOR UPDATE", nativeQuery = true)
    Optional<User> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") UUID id);

    Optional<User> findByGoogleSub(String googleSub);
    boolean existsByGoogleSub(String googleSub);

    /** 3.002 — Atomic increment of failed attempts. Returns new count. */
    @Modifying
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    @Query("UPDATE User u SET u.failedLoginAttempts = u.failedLoginAttempts + 1 WHERE u.email = :email")
    int incrementFailedAttempts(String email);

    /** 3.002 — Set lockout time. */
    @Modifying
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    @Query("UPDATE User u SET u.lockedUntil = :until WHERE u.email = :email")
    void lockAccount(String email, Instant until);

    /** 3.002 — Reset failed attempts on success. */
    @Modifying
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    @Query("UPDATE User u SET u.failedLoginAttempts = 0, u.lockedUntil = NULL WHERE u.email = :email")
    void resetFailedAttempts(String email);


    /**
     * Task 135 — AdminService.platformStats(): count only non-deleted users.
     * Spring Data derives the query from the field name deletedAt.
     */
    long countByDeletedAtIsNull();
}
