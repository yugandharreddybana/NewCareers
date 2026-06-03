package com.careerops.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.Locale;

/**
 * Removes raw baseline CV dumps from tailor output before HTML/markdown render or API preview.
 */
public final class TailorResumeSectionSanitizer {

    private TailorResumeSectionSanitizer() {}

    public static boolean isExcludedSectionName(String name) {
        if (name == null || name.isBlank()) {
            return true;
        }
        String lower = name.trim().toLowerCase(Locale.ROOT);
        return lower.equals("cv") || lower.equals("resume") || lower.equals("curriculum vitae");
    }

    public static boolean isRawCvDump(JsonNode row, String baselineMarkdown) {
        if (row == null || !row.isObject()) {
            return false;
        }
        if (isExcludedSectionName(row.path("name").asText(""))) {
            return true;
        }
        String rewritten = row.path("rewritten").asText("").trim();
        if (rewritten.isBlank()) {
            return false;
        }
        String original = row.path("original").asText("").trim();
        if (baselineMarkdown != null && !baselineMarkdown.isBlank()) {
            String baseline = baselineMarkdown.trim();
            if (rewritten.equals(baseline) || original.equals(baseline)) {
                return true;
            }
            if (rewritten.length() >= 800 && baseline.length() >= 800) {
                int probe = Math.min(120, Math.min(rewritten.length(), baseline.length()));
                if (rewritten.regionMatches(true, 0, baseline, 0, probe)) {
                    return true;
                }
            }
        }
        // Entire uploaded CV pasted into one section (name + contact + summary).
        if (rewritten.length() > 1_500
            && rewritten.contains("@")
            && (rewritten.toLowerCase(Locale.ROOT).contains("professional summary")
                || rewritten.toLowerCase(Locale.ROOT).contains("linkedin"))) {
            return true;
        }
        return false;
    }

    public static JsonNode sanitize(JsonNode sections, String baselineMarkdown) {
        if (sections == null || !sections.isArray()) {
            return sections;
        }
        ObjectMapper mapper = new ObjectMapper();
        ArrayNode out = mapper.createArrayNode();
        for (JsonNode row : sections) {
            if (!isRawCvDump(row, baselineMarkdown)) {
                out.add(row);
            }
        }
        return out;
    }

    public static void sanitizeOutputInPlace(ObjectNode out) {
        if (out == null) {
            return;
        }
        String baseline = out.path("baselineMarkdown").asText("");
        JsonNode cleaned = sanitize(out.path("sections"), baseline);
        out.set("sections", cleaned);
    }
}
