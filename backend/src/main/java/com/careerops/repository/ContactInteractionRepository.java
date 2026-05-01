package com.careerops.repository;

import com.careerops.model.ContactInteraction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Section 3.3 — Task 34 (repo layer)
 */
@Repository
public interface ContactInteractionRepository extends JpaRepository<ContactInteraction, UUID> {

    List<ContactInteraction> findByContactIdOrderByCreatedAtDesc(UUID contactId);

    List<ContactInteraction> findByUserIdOrderByCreatedAtDesc(UUID userId);

    /** Fetch all interactions where next step is overdue or due today */
    @Query("SELECT ci FROM ContactInteraction ci " +
           "WHERE ci.userId = :userId " +
           "AND ci.nextStepDueDate IS NOT NULL " +
           "AND ci.nextStepDueDate <= :today " +
           "ORDER BY ci.nextStepDueDate ASC")
    List<ContactInteraction> findOverdueByUser(
            @Param("userId") UUID userId,
            @Param("today") LocalDate today);
}
