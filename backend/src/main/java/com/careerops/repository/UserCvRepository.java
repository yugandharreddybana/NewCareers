package com.careerops.repository;

import com.careerops.model.UserCv;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface UserCvRepository extends JpaRepository<UserCv, UUID> {
    Optional<UserCv> findFirstByUserIdAndIsActiveTrueOrderByUploadedAtDesc(UUID userId);
}
