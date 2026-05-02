package com.careerops.repository;

import com.careerops.model.ContactInteraction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface ContactInteractionRepository extends JpaRepository<ContactInteraction, UUID> {

    List<ContactInteraction> findByContactIdOrderByCreatedAtDesc(UUID contactId);

    /**
     * Overdue: next_step_due_date < today AND outcome is no_response (i.e. still pending).
     * Uses string comparison — outcome stored as VARCHAR.
     */
    @Query("""
            SELECT ci FROM ContactInteraction ci
            WHERE ci.userId = :userId
              AND ci.nextStepDueDate IS NOT NULL
              AND ci.nextStepDueDate < :today
              AND (ci.outcome IS NULL OR ci.outcome = 'no_response')
            ORDER BY ci.nextStepDueDate ASC
            """)
    List<ContactInteraction> findOverdueByUser(@Param("userId") UUID userId,
                                               @Param("today") LocalDate today);

    @Modifying
    @Transactional
    @Query("DELETE FROM ContactInteraction ci WHERE ci.contactId = :contactId")
    void deleteByContactId(@Param("contactId") UUID contactId);
}
