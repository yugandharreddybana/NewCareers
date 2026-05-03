package com.careerops.repository;

import com.careerops.model.DeadLetterQueue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface DeadLetterQueueRepository extends JpaRepository<DeadLetterQueue, UUID> {
    List<DeadLetterQueue> findByStatusOrderByCreatedAtDesc(String status);
    List<DeadLetterQueue> findByStatusAndNextRetryAtBefore(String status, Instant now);
}
