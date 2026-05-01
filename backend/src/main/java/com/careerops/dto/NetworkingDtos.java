package com.careerops.dto;

import com.careerops.model.ContactInteraction.InteractionOutcome;
import com.careerops.model.ContactInteraction.InteractionType;
import com.careerops.model.NetworkContact.ContactPipelineStage;
import com.careerops.model.NetworkContact.ContactType;
import com.careerops.model.NetworkContact.RelationshipTemperature;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Section 3.3 — Tasks 36–38
 * All request/response DTOs for the networking module.
 */
public class NetworkingDtos {

    // ── Requests ───────────────────────────────────────────────────────────────

    public record CreateContactRequest(
            String name,
            String email,
            String linkedinUrl,
            String company,
            String roleTitle,
            ContactType contactType,
            RelationshipTemperature relationshipTemperature,
            ContactPipelineStage pipelineStage,
            String notes,
            UUID linkedUserJobId
    ) {}

    public record UpdateContactRequest(
            String name,
            String email,
            String linkedinUrl,
            String company,
            String roleTitle,
            ContactType contactType,
            RelationshipTemperature relationshipTemperature,
            ContactPipelineStage pipelineStage,
            String notes,
            UUID linkedUserJobId
    ) {}

    public record LogInteractionRequest(
            InteractionType interactionType,
            InteractionOutcome outcome,
            String notes,
            String nextStep,
            LocalDate nextStepDueDate
    ) {}

    // ── Responses ──────────────────────────────────────────────────────────────

    public record ContactResponse(
            UUID id,
            String name,
            String email,
            String linkedinUrl,
            String company,
            String roleTitle,
            ContactType contactType,
            RelationshipTemperature relationshipTemperature,
            ContactPipelineStage pipelineStage,
            String notes,
            UUID linkedUserJobId,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt,
            InteractionSummary lastInteraction
    ) {}

    public record InteractionSummary(
            UUID id,
            InteractionType interactionType,
            InteractionOutcome outcome,
            String nextStep,
            LocalDate nextStepDueDate,
            OffsetDateTime createdAt
    ) {}

    public record InteractionResponse(
            UUID id,
            UUID contactId,
            InteractionType interactionType,
            InteractionOutcome outcome,
            String notes,
            String nextStep,
            LocalDate nextStepDueDate,
            OffsetDateTime createdAt
    ) {}

    public record ContactListResponse(
            List<ContactResponse> contacts,
            long total
    ) {}
}
