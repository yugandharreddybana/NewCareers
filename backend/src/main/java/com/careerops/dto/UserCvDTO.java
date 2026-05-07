package com.careerops.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class UserCvDTO {
    private UUID id;
    private UUID userId;
    private String fileName;
    private String fileUrl;
    private String contentType;
    private Long fileSize;
    private Boolean active;
    private Instant createdAt;
}
