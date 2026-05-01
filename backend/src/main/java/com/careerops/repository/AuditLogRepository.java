package com.careerops.repository;

import com.careerops.model.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    List<AuditLog> findByUserIdOrderByCreatedAtDesc(UUID userId);

    /**
     * Task 135 — AdminService.platformStats(): total audit events in last 24 h.
     */
    @Query("SELECT COUNT(a) FROM AuditLog a WHERE a.createdAt >= :since")
    long countCreatedSince(@Param("since") Instant since);

    /**
     * Task 135 — AdminService.platformStats(): top N event types by frequency.
     * Each Object[] row = [action (String), count (Long)], ordered desc.
     * The caller (AdminService) limits to top 5.
     *
     * Note: AuditLog uses field 'action' (not 'eventType') — matches the entity.
     */
    @Query("""
        SELECT a.action, COUNT(a)
        FROM AuditLog a
        WHERE a.createdAt >= :since
        GROUP BY a.action
        ORDER BY COUNT(a) DESC
        """)
    List<Object[]> topEventTypesSince(@Param("since") Instant since);
}
