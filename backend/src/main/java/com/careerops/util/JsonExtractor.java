package com.careerops.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Robust JSON extraction utility (3.072).
 * Consolidates the logic for extracting JSON payloads from AI model responses,
 * handling markdown code fences and prefix/suffix noise.
 */
public class JsonExtractor {
    private static final Logger log = LoggerFactory.getLogger(JsonExtractor.class);

    public static JsonNode extract(String text, ObjectMapper mapper) {
        if (text == null || text.isBlank()) {
            return mapper.createObjectNode().put("text", "No output generated.");
        }

        // 3.057 / 3.072 — Use balanced brace searching instead of fragile fence stripping
        int firstBrace = text.indexOf('{');
        int lastBrace  = text.lastIndexOf('}');

        if (firstBrace >= 0 && lastBrace > firstBrace) {
            String candidate = text.substring(firstBrace, lastBrace + 1);
            try {
                return mapper.readTree(candidate);
            } catch (Exception e) {
                log.warn("JsonExtractor: Balanced brace extraction failed, falling back to raw: {}", e.getMessage());
            }
        }

        // Fallback: Return as a text-wrapped node
        return mapper.createObjectNode().put("raw", text);
    }
}
