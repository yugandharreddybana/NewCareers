package com.careerops.repository;

import com.careerops.model.ExperimentAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ExperimentAssignmentRepository extends JpaRepository<ExperimentAssignment, UUID> {

    Optional<ExperimentAssignment> findByExperimentIdAndUserId(UUID experimentId, UUID userId);

    List<ExperimentAssignment> findByUserId(UUID userId);

    List<ExperimentAssignment> findByExperimentId(UUID experimentId);

    // Task 80 — variant assignment counts for the dashboard
    @Query("""
        SELECT a.variant, COUNT(a) FROM ExperimentAssignment a
        WHERE a.experimentId = :experimentId
        GROUP BY a.variant
        """)
    List<Object[]> countByVariantForExperiment(@Param("experimentId") UUID experimentId);
}
