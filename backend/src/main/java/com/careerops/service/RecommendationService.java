package com.careerops.service;

import com.careerops.dto.AnalyticsDtos2.*;
import com.careerops.model.RecommendationFeedback;
import com.careerops.repository.RecommendationFeedbackRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class RecommendationService {

    private final RecommendationFeedbackRepository feedbackRepo;

    public RecommendationService(RecommendationFeedbackRepository feedbackRepo) {
        this.feedbackRepo = feedbackRepo;
    }

    /** Submit thumbs-up/down feedback on a recommendation */
    public void submitFeedback(UUID userId, RecommendationFeedbackRequest req) {
        RecommendationFeedback fb = RecommendationFeedback.builder()
            .userId(userId)
            .userJobId(req.userJobId())
            .feedbackType(req.feedbackType())
            .reason(req.reason())
            .build();
        feedbackRepo.save(fb);
    }

    /** Feedback stats for the current user */
    public Map<String, Object> getFeedbackStats(UUID userId) {
        long useful    = feedbackRepo.countByUserIdAndFeedbackType(userId, "useful");
        long notUseful = feedbackRepo.countByUserIdAndFeedbackType(userId, "not_useful");
        long hidden    = feedbackRepo.countByUserIdAndFeedbackType(userId, "hide_similar");
        return Map.of(
            "useful",    useful,
            "notUseful", notUseful,
            "hidden",    hidden,
            "total",     useful + notUseful + hidden
        );
    }

    /** All feedback entries for the current user */
    public List<RecommendationFeedback> listFeedback(UUID userId) {
        return feedbackRepo.findByUserIdOrderByCreatedAtDesc(userId);
    }
}
