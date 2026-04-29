package com.careerops.repository;

import com.careerops.model.SeenJob;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SeenJobRepository extends JpaRepository<SeenJob, SeenJob.PK> {
    boolean existsByUserIdAndFingerprint(java.util.UUID userId, String fingerprint);
}
