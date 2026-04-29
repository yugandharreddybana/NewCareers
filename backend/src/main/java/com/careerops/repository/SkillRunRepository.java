package com.careerops.repository;

import com.careerops.model.SkillRun;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface SkillRunRepository extends JpaRepository<SkillRun, UUID> {
    Optional<SkillRun> findFirstByUserIdAndUserJobIdAndSkillOrderByCreatedAtDesc(UUID userId, UUID userJobId, String skill);
}
