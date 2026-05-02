package com.careerops.repository;

import com.careerops.model.ApplicationRun;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ApplicationRunRepository extends JpaRepository<ApplicationRun, UUID> {
    List<ApplicationRun> findByUserIdOrderByCreatedAtDesc(UUID userId);
    List<ApplicationRun> findByUserIdAndStatusOrderByCreatedAtDesc(UUID userId, String status);
    Optional<ApplicationRun> findByIdAndUserId(UUID id, UUID userId);
    List<ApplicationRun> findByUserJobId(UUID userJobId);
}
