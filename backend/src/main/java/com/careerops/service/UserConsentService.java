package com.careerops.service;

import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class UserConsentService {

    /** AI skills are enabled by default; no separate opt-in in the product UI. */
    public void validateAiConsent(UUID userId) {
        // no-op
    }
}
