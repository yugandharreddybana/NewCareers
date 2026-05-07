package com.careerops.repository;

import com.careerops.model.BatchSkillRun;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface BatchSkillRunRepository extends JpaRepository<BatchSkillRun, UUID> {
    Optional<BatchSkillRun> findByIdAndUserId(UUID id, UUID userId);
}
