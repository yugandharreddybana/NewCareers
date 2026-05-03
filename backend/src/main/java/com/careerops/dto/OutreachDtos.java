package com.careerops.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class OutreachDtos {

    public record CreateCampaignRequest(
        String name,
        String campaignType
    ) {}

    public record CampaignResponse(
        UUID id,
        String name,
        String campaignType,
        String status,
        int targetCount,
        int sentCount,
        int repliedCount,
        int positiveCount,
        double replyRate,
        Instant createdAt,
        List<SequenceResponse> sequences,
        List<MessageResponse> messages
    ) {}

    public record CampaignListResponse(List<CampaignResponse> campaigns, int total) {}

    public record CreateSequenceRequest(
        short stepNumber,
        short delayDays,
        String subjectTemplate,
        String bodyTemplate,
        String channel
    ) {}

    public record SequenceResponse(
        UUID id,
        short stepNumber,
        short delayDays,
        String subjectTemplate,
        String bodyTemplate,
        String channel
    ) {}

    public record AddMessageRequest(
        String contactName,
        String contactEmail,
        String contactLinkedin,
        String personalisedBody,
        UUID sequenceId
    ) {}

    public record MessageResponse(
        UUID id,
        String contactName,
        String contactEmail,
        String contactLinkedin,
        String personalisedBody,
        String status,
        Short score,
        boolean unsubscribed,
        String sendTimeHint,
        Instant sentAt,
        Instant repliedAt,
        Instant createdAt
    ) {}

    public record UpdateMessageStatusRequest(String status) {}

    public record SendTimeSuggestionResponse(
        String bestDay,
        String bestHour,
        String rationale
    ) {}
}
