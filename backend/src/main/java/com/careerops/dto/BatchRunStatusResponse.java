package com.careerops.dto;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record BatchRunStatusResponse(
    UUID id,
    UUID userJobId,
    String status,
    int total,
    int completed,
    Instant createdAt,
    Map<String, SkillRunResponse> results
) {}
