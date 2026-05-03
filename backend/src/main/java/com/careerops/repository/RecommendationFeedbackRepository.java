package com.careerops.repository;

import com.careerops.model.RecommendationFeedback;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RecommendationFeedbackRepository extends JpaRepository<RecommendationFeedback, UUID> {
    List<RecommendationFeedback> findByUserIdOrderByCreatedAtDesc(UUID userId);
    long countByUserIdAndFeedbackType(UUID userId, String feedbackType);
}
