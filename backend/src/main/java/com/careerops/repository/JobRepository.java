package com.careerops.repository;

import com.careerops.model.Job;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface JobRepository extends JpaRepository<Job, UUID> {
    Optional<Job> findByFingerprint(String fingerprint);
}
