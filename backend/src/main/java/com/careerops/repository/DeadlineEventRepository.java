package com.careerops.repository;

import com.careerops.model.DeadlineEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface DeadlineEventRepository extends JpaRepository<DeadlineEvent, UUID> {

    List<DeadlineEvent> findByUserJobIdOrderByEventDateAsc(UUID userJobId);

    List<DeadlineEvent> findByUserIdAndEventDateBetweenOrderByEventDateAsc(
            UUID userId, LocalDateTime from, LocalDateTime to);

    List<DeadlineEvent> findByEventDateBetweenAndReminderSentFalse(
            LocalDateTime from, LocalDateTime to);
}
