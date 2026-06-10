package com.careerops.service.skills;

import com.fasterxml.jackson.databind.JsonNode;

public record SkillHandlerResult(JsonNode output, int totalTokens) {}
