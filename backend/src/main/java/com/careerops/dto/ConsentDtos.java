package com.careerops.dto;

import com.careerops.model.UserConsent.ConsentType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.UUID;

public class ConsentDtos {

    public static final String CONSENT_VERSION = "v1.0";

    public record SignupConsentsRequest(
            @NotNull Boolean termsAccepted,
            @NotNull Boolean aiProcessingAccepted,
            @NotNull Boolean marketingAccepted,
            @NotNull Boolean analyticsAccepted
    ) {}

    public record UpdateConsentRequest(
            @NotNull ConsentType consentType,
            @NotBlank String version,
            @NotNull Boolean accepted
    ) {}

    public record ConsentResponse(
            UUID id,
            ConsentType consentType,
            String version,
            boolean accepted,
            Instant acceptedAt
    ) {}

    public record ConsentTypeStatus(
            boolean accepted,
            String version,
            Instant acceptedAt
    ) {}

    public record ConsentStatusResponse(
            ConsentTypeStatus essential,
            ConsentTypeStatus aiProcessing,
            ConsentTypeStatus marketing,
            ConsentTypeStatus analytics
    ) {}
}
