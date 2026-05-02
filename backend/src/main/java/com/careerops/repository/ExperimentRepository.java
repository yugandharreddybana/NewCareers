package com.careerops.repository;

import com.careerops.model.Experiment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ExperimentRepository extends JpaRepository<Experiment, UUID> {
    Optional<Experiment> findByKey(String key);
    List<Experiment> findByStatus(String status);
}
