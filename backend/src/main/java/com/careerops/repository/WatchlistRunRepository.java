package com.careerops.repository;

import com.careerops.model.WatchlistRun;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface WatchlistRunRepository extends JpaRepository<WatchlistRun, UUID> {
    List<WatchlistRun> findByWatchlistIdOrderByRunAtDesc(UUID watchlistId);
    List<WatchlistRun> findByUserIdOrderByRunAtDesc(UUID userId);
}
