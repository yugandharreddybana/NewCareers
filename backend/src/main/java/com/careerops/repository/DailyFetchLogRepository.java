package com.careerops.repository;

import com.careerops.model.DailyFetchLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

public interface DailyFetchLogRepository extends JpaRepository<DailyFetchLog, DailyFetchLog.PK> {
    Optional<DailyFetchLog> findByUserIdAndFetchDate(UUID userId, LocalDate date);
}
