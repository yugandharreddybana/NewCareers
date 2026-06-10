package com.careerops.dto;

import com.fasterxml.jackson.databind.JsonNode;

/** Parsed JSON plus token usage from a single LLM completion. */
public record LlmJsonResult(JsonNode json, int totalTokens) {}
