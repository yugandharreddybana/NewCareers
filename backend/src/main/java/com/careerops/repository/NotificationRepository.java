package com.careerops.repository;

import com.careerops.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Modifying;

/**
 * Repository for Notification entities.
 *
 * Notes:
 *   - countByUserIdAndReadFalse returns int (not long) so it can be placed
 *     directly into Map.of("unread", count) without a cast.
 *   - The custom @Query on countUnread avoids a derived-query long→int ambiguity
 *     on some Spring Data versions.
 */
@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {



    List<Notification> findByUserIdAndReadFalse(UUID userId);
    boolean existsByUserIdAndTypeAndCreatedAtAfter(UUID userId, String type, java.time.Instant createdAt);

    Page<Notification> findByUserIdAndCreatedAtBefore(UUID userId, java.time.Instant cursor, org.springframework.data.domain.Pageable pageable);



    @Query("SELECT n FROM Notification n WHERE n.userId = :userId ORDER BY n.createdAt DESC")
    Page<Notification> findByUserIdOrderByCreatedAtDesc(@Param("userId") UUID userId, Pageable pageable);

    @Query("SELECT n FROM Notification n WHERE n.userId = :userId AND n.read = false ORDER BY n.createdAt DESC")
    Page<Notification> findByUserIdAndReadFalseOrderByCreatedAtDesc(@Param("userId") UUID userId, Pageable pageable);

    @Query("SELECT n FROM Notification n WHERE n.id = :id AND n.userId = :userId")
    Optional<Notification> findByIdAndUserId(@Param("id") UUID id, @Param("userId") UUID userId);

    @Modifying
    @Query("UPDATE Notification n SET n.read = true WHERE n.userId = :userId AND n.read = false")
    void markAllReadByUserId(@Param("userId") UUID userId);

    @Modifying
    @Query("DELETE FROM Notification n WHERE n.userId = :userId")
    void deleteByUserId(@Param("userId") UUID userId);

    @Query("SELECT CAST(COUNT(n) AS int) FROM Notification n WHERE n.userId = :userId AND n.read = false")
    int countByUserIdAndReadFalse(@Param("userId") UUID userId);
}
