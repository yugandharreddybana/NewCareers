package com.careerops.service;

import com.careerops.model.FeatureAdoptionEvent;
import com.careerops.model.OnboardingEvent;
import com.careerops.repository.FeatureAdoptionEventRepository;
import com.careerops.repository.OnboardingEventRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class OnboardingAnalyticsService {

    private final OnboardingEventRepository onboardingRepo;
    private final FeatureAdoptionEventRepository featureRepo;
    private final ObjectMapper mapper;
    private final UserConsentService consentService;

    @Transactional(timeout = 10, readOnly = true)
    public List<String> getCompletedSteps(UUID userId) {
        return onboardingRepo.findCompletedStepsByUserId(userId);
    }

    @Transactional(timeout = 10)
    public void trackOnboardingStep(UUID userId, String step, String eventType, Map<String, Object> metadata) {
        if (!consentService.hasAnalyticsConsent(userId)) {
            return;
        }
        try {
            onboardingRepo.save(OnboardingEvent.builder()
                .userId(userId)
                .step(step)
                .eventType(eventType)
                .metadata(toJsonNode(metadata))
                .build());
        } catch (Exception e) {
            log.warn("[OnboardingAnalytics] Failed to track step={} for user={}: {}", step, userId, e.getMessage());
        }
    }

    @Transactional(timeout = 10)
    public void trackFeatureAdoption(UUID userId, String feature, String action, Map<String, Object> metadata) {
        if (!consentService.hasAnalyticsConsent(userId)) {
            return;
        }
        try {
            featureRepo.save(FeatureAdoptionEvent.builder()
                .userId(userId)
                .feature(feature)
                .action(action)
                .metadata(toJsonNode(metadata))
                .build());
        } catch (Exception e) {
            log.warn("[FeatureAdoption] Failed to track feature={} for user={}: {}", feature, userId, e.getMessage());
        }
    }

    private JsonNode toJsonNode(Map<String, Object> metadata) {
        if (metadata == null || metadata.isEmpty()) return mapper.createObjectNode();
        return mapper.valueToTree(metadata);
    }
}
