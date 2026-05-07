package com.careerops.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class WorkspaceDTO {

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CreateRequest {
        @jakarta.validation.constraints.NotBlank(message = "Name is required")
        @jakarta.validation.constraints.Size(max = 100, message = "Name too long")
        private String name;
        @jakarta.validation.constraints.Size(max = 500, message = "Description too long")
        private String description;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class InviteRequest {
        @jakarta.validation.constraints.NotBlank(message = "Email is required")
        @jakarta.validation.constraints.Email(message = "Invalid email format")
        private String email;
        @jakarta.validation.constraints.NotBlank(message = "Role is required")
        private String role; // mentor | reviewer
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class NoteRequest {
        @jakarta.validation.constraints.NotBlank(message = "Target type is required")
        private String targetType;
        @jakarta.validation.constraints.NotNull(message = "Target ID is required")
        private UUID targetId;
        @jakarta.validation.constraints.NotBlank(message = "Content is required")
        @jakarta.validation.constraints.Size(max = 2000, message = "Content too long")
        private String content;
        private UUID parentNoteId;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class WorkspaceResponse {
        private UUID id;
        private UUID ownerId;
        private String name;
        private String description;
        private Instant createdAt;
        private Instant updatedAt;
        private List<MemberResponse> members;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class MemberResponse {
        private UUID id;
        private UUID userId;
        private String invitedEmail;
        private String role;
        private String inviteStatus;
        private Instant joinedAt;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class NoteResponse {
        private UUID id;
        private UUID workspaceId;
        private UUID authorId;
        private String targetType;
        private UUID targetId;
        private String content;
        private UUID parentNoteId;
        private Boolean resolved;
        private Instant createdAt;
        private Instant updatedAt;
    }
}
