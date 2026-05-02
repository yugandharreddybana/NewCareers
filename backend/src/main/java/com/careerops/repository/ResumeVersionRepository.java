package com.careerops.repository;

import com.careerops.model.ResumeVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ResumeVersionRepository extends JpaRepository<ResumeVersion, UUID> {
    List<ResumeVersion> findByUserIdOrderByVersionNumberDesc(UUID userId);
    Optional<ResumeVersion> findByIdAndUserId(UUID id, UUID userId);
    Optional<ResumeVersion> findByUserIdAndActiveTrue(UUID userId);
    int countByUserId(UUID userId);
}
