package com.careerops.repository;

import com.careerops.model.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Section 8 — Task 80
 * Repository for the notifications table.
 */
@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    /** All notifications for a user, newest first — used for the drawer list. */
    Page<Notification> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    /** Unread badge count — hits the partial index, very fast. */
    long countByUserIdAndReadFalse(UUID userId);

    /** Fetch a single notification that belongs to a specific user (security check). */
    Optional<Notification> findByIdAndUserId(UUID id, UUID userId);

    /**
     * Bulk mark-all-read — single UPDATE vs N individual saves.
     * Only touches rows that are currently unread.
     */
    @Modifying
    @Query("UPDATE Notification n SET n.read = true WHERE n.userId = :userId AND n.read = false")
    void markAllReadByUserId(@Param("userId") UUID userId);

    /** Delete all notifications for a user (clear-all). */
    void deleteByUserId(UUID userId);
}
