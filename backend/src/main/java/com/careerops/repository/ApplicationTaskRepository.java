package com.careerops.repository;

import com.careerops.model.ApplicationTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface ApplicationTaskRepository extends JpaRepository<ApplicationTask, UUID> {

    List<ApplicationTask> findByUserJobIdOrderByDueDateAsc(UUID userJobId);

    List<ApplicationTask> findByUserIdOrderByDueDateAsc(UUID userId);

    /**
     * Returns tasks whose dueDate falls within [from, to] (inclusive)
     * that are not yet completed, so the deadline cron can send reminders.
     */
    @Query("""
            SELECT t FROM ApplicationTask t
            WHERE t.dueDate IS NOT NULL
              AND t.dueDate >= :from
              AND t.dueDate <= :to
              AND t.status <> 'DONE'
            ORDER BY t.dueDate ASC
            """)
    List<ApplicationTask> findUpcomingDeadlines(@Param("from") LocalDate from,
                                                @Param("to")   LocalDate to);
}
