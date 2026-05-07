package com.careerops.repository;

import com.careerops.model.Job;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

@org.springframework.stereotype.Repository
@org.springframework.transaction.annotation.Transactional(readOnly = true)
public interface JobRepository extends JpaRepository<Job, UUID> {
    Optional<Job> findByFingerprint(String fingerprint);
    Page<JobCardProjection> findAllProjectedBy(Pageable pageable);
}
