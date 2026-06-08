package com.careerops.repository;

import com.careerops.model.UserTwoFactor;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface UserTwoFactorRepository extends JpaRepository<UserTwoFactor, UUID> {
}
