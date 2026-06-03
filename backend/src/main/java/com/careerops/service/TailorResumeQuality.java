package com.careerops.service;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.Locale;

/** Detects whether tailor output actually changed the CV vs echoing the baseline. */
public final class TailorResumeQuality {

    private TailorResumeQuality() {}

    public static boolean isSubstantiallyTailored(JsonNode output) {
        if (output == null || !output.isObject()) return false;
        JsonNode sections = output.path("sections");
        if (!sections.isArray() || sections.isEmpty()) return false;

        boolean summaryChanged = false;
        boolean experienceChanged = false;

        for (JsonNode row : sections) {
            String name = row.path("name").asText("").toLowerCase(Locale.ROOT);
            String original = row.path("original").asText("").trim();
            String rewritten = row.path("rewritten").asText("").trim();
            if (rewritten.isBlank()) continue;
            if (original.equals(rewritten)) continue;

            if (name.contains("summary")) {
                summaryChanged = true;
            }
            if (name.contains("experience") && rewritten.length() > 40
                    && ExperienceSectionParser.hasRoleStructure(rewritten)) {
                experienceChanged = true;
            }
        }

        String summary = output.path("summary").asText("").trim();
        if (!summary.isBlank() && sections.size() > 0) {
            String summaryOriginal = "";
            for (JsonNode row : sections) {
                if (row.path("name").asText("").toLowerCase(Locale.ROOT).contains("summary")) {
                    summaryOriginal = row.path("original").asText("").trim();
                    break;
                }
            }
            if (!summary.equals(summaryOriginal)) {
                summaryChanged = true;
            }
        }

        return summaryChanged && experienceChanged;
    }
}
