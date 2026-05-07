package com.careerops.repository;

import com.careerops.model.DailyActivity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.UUID;

@Repository
public interface DailyActivityRepository extends JpaRepository<DailyActivity, DailyActivity.DailyActivityId> {

    /**
     * Issue 2.067 — Idempotent insert of daily activity.
     * Returns 1 if inserted, 0 if already exists.
     */
    @Modifying
    @Query(value = "INSERT INTO daily_activity_log (user_id, activity_date, created_at) " +
                   "VALUES (:userId, :date, NOW()) ON CONFLICT DO NOTHING", nativeQuery = true)
    int recordIdempotent(@Param("userId") UUID userId, @Param("date") LocalDate date);
}
