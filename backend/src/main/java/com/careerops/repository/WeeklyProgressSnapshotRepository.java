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
}
