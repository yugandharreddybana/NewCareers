package com.careerops.repository;

import com.careerops.model.ApplicationTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface ApplicationTaskRepository extends JpaRepository<ApplicationTask, UUID> {

    List<ApplicationTask> findByUserJobIdOrderBySortOrderAscCreatedAtAsc(UUID userJobId);

    List<ApplicationTask> findByUserIdAndStatusOrderByDueDateAsc(UUID userId, String status);

    List<ApplicationTask> findByUserIdOrderByDueDateAscCreatedAtDesc(UUID userId);

    @Query("SELECT t FROM ApplicationTask t WHERE t.userId = :userId " +
           "AND t.status = 'PENDING' AND t.dueDate < :now")
    List<ApplicationTask> findOverdueTasks(UUID userId, OffsetDateTime now);

    void deleteByUserJobId(UUID userJobId);
}
