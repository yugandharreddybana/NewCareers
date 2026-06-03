package com.careerops.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.UUID;

public record SkillRunHistoryItem(
        UUID id,
        Instant createdAt,
        JsonNode output) {}
