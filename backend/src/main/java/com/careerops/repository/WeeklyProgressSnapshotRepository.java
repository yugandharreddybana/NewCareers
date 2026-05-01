package com.careerops.repository;

import com.careerops.model.WeeklyProgressSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WeeklyProgressSnapshotRepository extends JpaRepository<WeeklyProgressSnapshot, UUID> {

    Optional<WeeklyProgressSnapshot> findByUserIdAndWeekStart(UUID userId, LocalDate weekStart);

    List<WeeklyProgressSnapshot> findByUserIdOrderByWeekStartDesc(UUID userId);

    @Query("""
        SELECT s FROM WeeklyProgressSnapshot s
        WHERE s.userId = :userId
          AND s.weekStart >= :from
        ORDER BY s.weekStart DESC
        """)
    List<WeeklyProgressSnapshot> findRecentByUser(
            @Param("userId") UUID userId,
            @Param("from") LocalDate from);

    /**
     * Task 66 — returns snapshots for a given week alongside the user's email
     * and first name from the users table so the scheduler can send emails
     * without a separate N+1 user lookup.
     */
    @Query(value = """
        SELECT s.*, u.email AS user_email, u.first_name AS user_first_name
        FROM weekly_progress_snapshots s
        JOIN users u ON u.id = s.user_id
        WHERE s.week_start = :weekStart
          AND u.email_weekly_progress = true
        """, nativeQuery = true)
    List<WeeklyProgressSnapshot> findByWeekStartWithUserEmail(
            @Param("weekStart") LocalDate weekStart);
}
