package com.careerops.service;

import com.careerops.exception.ApiException;
import com.careerops.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class UserConsentService {

    private final UserRepository users;

    public UserConsentService(UserRepository users) {
        this.users = users;
    }

    /**
     * Enforces GDPR compliance by checking if the user has consented to AI processing (3.081).
     * Throws ApiException if consent is missing.
     */
    public void validateAiConsent(UUID userId) {
        if (userId == null) return; // System calls or unauthenticated context (should be handled by security)

        boolean consented = users.findById(userId)
            .map(com.careerops.model.User::isAiProcessingConsent)
            .orElse(false);

        if (!consented) {
            throw new ApiException(HttpStatus.FORBIDDEN, 
                "AI Processing Consent Required. Please enable 'AI Features' in your account settings to continue.");
        }
    }
}
