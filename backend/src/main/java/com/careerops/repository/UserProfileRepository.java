package com.careerops.repository;

import com.careerops.model.UserProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserProfileRepository extends JpaRepository<UserProfile, UUID> {
    Optional<UserProfile> findByUserId(UUID userId);
    List<UserProfile> findAllByOnboardedTrue();
}
