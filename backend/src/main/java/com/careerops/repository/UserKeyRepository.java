package com.careerops.repository;

import com.careerops.model.UserKey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface UserKeyRepository extends JpaRepository<UserKey, UUID> {
    boolean existsByUserId(UUID userId);
}
