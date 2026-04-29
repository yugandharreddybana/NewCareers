package com.careerops.repository;

import com.careerops.model.UserJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserJobRepository extends JpaRepository<UserJob, UUID> {
    List<UserJob> findByUserIdOrderByDeliveredAtDesc(UUID userId);
    Optional<UserJob> findByUserIdAndJobId(UUID userId, UUID jobId);
    Optional<UserJob> findByIdAndUserId(UUID id, UUID userId);

    @Query("select uj from UserJob uj where uj.userId = :uid and uj.kanbanColumn <> 'Discovered'")
    List<UserJob> findKanbanForUser(@Param("uid") UUID userId);

    long countByUserId(UUID userId);
    long countByUserIdAndKanbanColumn(UUID userId, String column);
}
