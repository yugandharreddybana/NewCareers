package com.careerops.repository;

import com.careerops.model.PasswordReset;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface PasswordResetRepository extends JpaRepository<PasswordReset, UUID> {
    Optional<PasswordReset> findFirstByEmailAndUsedFalseOrderByCreatedAtDesc(String email);
}
