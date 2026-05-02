package com.careerops.repository;

import com.careerops.model.ApplicationTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface ApplicationTaskRepository extends JpaRepository<ApplicationTask, UUID> {

    List<ApplicationTask> findByUserJobIdOrderByDueDateAsc(UUID userJobId);

    List<ApplicationTask> findByUserIdAndStatusNotOrderByDueDateAsc(UUID userId, String status);

    // Upcoming tasks within N days for the user
    @Query("SELECT t FROM ApplicationTask t WHERE t.userId = :userId " +
           "AND t.status = 'PENDING' AND t.dueDate BETWEEN :from AND :to " +
           "ORDER BY t.dueDate ASC")
    List<ApplicationTask> findUpcomingByUser(UUID userId, LocalDateTime from, LocalDateTime to);

    // Overdue tasks not yet reminded
    List<ApplicationTask> findByStatusAndDueDateBeforeAndReminderSentFalse(
            String status, LocalDateTime deadline);

    long countByUserJobIdAndStatus(UUID userJobId, String status);

    long countByUserJobIdAndStatusNot(UUID userJobId, String status);
}
