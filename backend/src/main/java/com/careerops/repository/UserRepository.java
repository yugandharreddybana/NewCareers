package com.careerops.repository;

import com.careerops.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    boolean existsByEmail(String email);
    boolean existsByUsername(String username);
    Optional<User> findByEmail(String email);
    /** Task 117 — lookup by hashed refresh token for rotation/validation. */
    Optional<User> findByRefreshToken(String refreshTokenHash);
}
