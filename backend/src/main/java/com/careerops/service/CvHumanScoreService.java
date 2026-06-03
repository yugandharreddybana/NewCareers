package com.careerops.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.careerops.util.JsonExtractor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * CV Human Score Service
 *
 * Produces a human-readable quality score for a CV.
 *
 * B2-G2 FIX: Previously called ClaudeDirectService.generateJson() directly,
 * bypassing the AI provider router and gaining no Gemini-first failover or
 * unified metrics. Now routes through AiProviderRouter.routePrompt() so:
 *   - Primary:  GeminiService  (cheap, fast)
 *   - Fallback: ClaudeDirectService (reliable)
 *   - Metrics:  AiProviderMetricsService tracks success/failure for both
 */
@Service
@Slf4j
public class CvHumanScoreService {

    private static final String SYSTEM_PROMPT = """
        You are an expert CV reviewer. Analyse the CV and return ONLY a JSON object with this exact structure:
        {
          "overallScore": <integer 0-100>,
          "clarity": <integer 0-100>,
          "relevance": <integer 0-100>,
          "impact": <integer 0-100>,
          "formatting": <integer 0-100>,
          "keyStrengths": ["strength1", "strength2", "strength3"],
          "improvements": ["improvement1", "improvement2", "improvement3"],
          "humanSummary": "<2-3 sentence narrative evaluation>"
        }
        No markdown, no explanation outside the JSON.
        """;

    private final AiProviderRouter router;   // B2-G2: route through Gemini-first failover
    private final ObjectMapper     mapper;

    public CvHumanScoreService(AiProviderRouter router, ObjectMapper mapper) {
        this.router = router;
        this.mapper = mapper;
    }

    /**
     * Score a CV text and return a JsonNode with all score dimensions.
     * Routes via AiProviderRouter for Gemini-first failover + metrics.
     */
    public JsonNode score(UUID userId, String cvText) {
        if (cvText == null || cvText.isBlank()) {
            return buildErrorResponse("No CV text provided");
        }

        String prompt = """
            Please analyse the following CV and return a structured JSON score:

            CV TEXT:
            %s
            """.formatted(trim(cvText, 8000));

        try {
            String raw = router.routePrompt(SYSTEM_PROMPT + "\n\n" + prompt, userId, "cv-human-score");
            JsonNode result = JsonExtractor.extract(raw, mapper);
            if (result.isMissingNode() || result.isNull()) {
                log.warn("[CvHumanScore] AI returned empty/null for userId={}", userId);
                return buildErrorResponse("AI returned an empty response");
            }
            return normalizeScore(result);
        } catch (Exception e) {
            log.error("[CvHumanScore] Failed for userId={}: {}", userId, e.getMessage());
            return buildErrorResponse("CV scoring failed: " + e.getMessage());
        }
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private JsonNode normalizeScore(JsonNode raw) {
        ObjectNode out = raw.deepCopy();
        for (String field : new String[]{"overallScore", "clarity", "relevance", "impact", "formatting"}) {
            if (out.has(field)) {
                int clamped = Math.max(0, Math.min(100, out.get(field).asInt(50)));
                out.put(field, clamped);
            }
        }
        return out;
    }

    private JsonNode buildErrorResponse(String reason) {
        ObjectNode err = mapper.createObjectNode();
        err.put("overallScore", 0);
        err.put("error", reason);
        return err;
    }

    private static String trim(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "...[truncated]";
    }
}
