package com.careerops.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.UUID;

public class SkillDtos {
    public record SkillRequest(UUID userJobId, JsonNode params) {}
    public record SkillResponse(String skill, JsonNode result, java.time.Instant generatedAt) {}
    public record CompareRequest(List<UUID> userJobIds) {}
    public record TriageRequest() {}
    public record OutreachRequest(UUID userJobId, String channel, String tone) {}
    public record ApplyRequest(UUID userJobId, String step) {}
}
