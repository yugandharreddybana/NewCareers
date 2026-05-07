package com.careerops.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class NotificationDTO {
    private UUID id;
    private String type;
    private String subject;
    private String body;
    private boolean read;
    private String entityType;
    private String entityId;
    private Map<String, Object> metadata;
    private Instant createdAt;

    public record UnreadCountResponse(int unread) {}
}
