package com.careerops.repository;

import com.careerops.model.JobWatchlist;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface JobWatchlistRepository extends JpaRepository<JobWatchlist, UUID> {
    List<JobWatchlist> findByUserIdOrderByCreatedAtDesc(UUID userId);
    List<JobWatchlist> findByUserIdAndStatusOrderByCreatedAtDesc(UUID userId, String status);
    Optional<JobWatchlist> findByIdAndUserId(UUID id, UUID userId);
    List<JobWatchlist> findByStatus(String status);
}
