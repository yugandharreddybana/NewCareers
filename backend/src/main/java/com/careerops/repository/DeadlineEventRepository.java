package com.careerops.repository;

import com.careerops.model.DeadlineEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface DeadlineEventRepository extends JpaRepository<DeadlineEvent, UUID> {

    List<DeadlineEvent> findByUserJobIdOrderByEventDateAsc(UUID userJobId);

    List<DeadlineEvent> findByUserIdAndIsCompletedFalseOrderByEventDateAsc(UUID userId);

    @Query("SELECT d FROM DeadlineEvent d WHERE d.reminderSent = FALSE " +
           "AND d.remindAt IS NOT NULL AND d.remindAt <= :now")
    List<DeadlineEvent> findDueReminders(OffsetDateTime now);

    @Query("SELECT d FROM DeadlineEvent d WHERE d.userId = :userId " +
           "AND d.isCompleted = FALSE AND d.eventDate BETWEEN :from AND :to " +
           "ORDER BY d.eventDate ASC")
    List<DeadlineEvent> findUpcoming(UUID userId, OffsetDateTime from, OffsetDateTime to);

    void deleteByUserJobId(UUID userJobId);
}
