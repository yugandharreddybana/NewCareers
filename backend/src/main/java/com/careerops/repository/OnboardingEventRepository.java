package com.careerops.repository;

import com.careerops.model.OnboardingEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface OnboardingEventRepository extends JpaRepository<OnboardingEvent, UUID> {
    @Query("SELECT e.step FROM OnboardingEvent e WHERE e.userId = :userId AND e.eventType = 'completed'")
    List<String> findCompletedStepsByUserId(@Param("userId") UUID userId);
}
