package com.careerops.repository;

import com.careerops.model.ApplicationRunStep;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ApplicationRunStepRepository extends JpaRepository<ApplicationRunStep, UUID> {
    List<ApplicationRunStep> findByRunIdOrderByStepNumberAsc(UUID runId);
    List<ApplicationRunStep> findByRunIdAndStatus(UUID runId, String status);
}
