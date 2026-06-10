package com.careerops.service;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.Locale;

/** Detects whether tailor output actually changed the CV vs echoing the baseline. */
public final class TailorResumeQuality {

    private TailorResumeQuality() {}

    public record Diagnosis(
            boolean summaryChanged,
            boolean experienceChanged,
            int changedSectionCount,
            int backfilledSectionCount) {}

    public static Diagnosis diagnose(JsonNode output) {
        if (output == null || !output.isObject()) {
            return new Diagnosis(false, false, 0, 0);
        }
        JsonNode sections = output.path("sections");
        if (!sections.isArray() || sections.isEmpty()) {
            return new Diagnosis(false, false, 0, 0);
        }

        boolean summaryChanged = false;
        boolean experienceChanged = false;
        int changed = 0;
        int backfilled = 0;

        for (JsonNode row : sections) {
            String name = row.path("name").asText("").toLowerCase(Locale.ROOT);
            String original = row.path("original").asText("").trim();
            String rewritten = row.path("rewritten").asText("").trim();
            String rationale = row.path("rationale").asText("");
            if (rationale.contains("AI did not return this section")) {
                backfilled++;
            }
            if (rewritten.isBlank()) continue;
            if (original.equals(rewritten)) continue;
            changed++;

            if (name.contains("summary")) {
                summaryChanged = true;
            }
            if (name.contains("experience") && rewritten.length() > 40
                    && ExperienceSectionParser.hasRoleStructure(rewritten)) {
                experienceChanged = true;
            }
        }

        String summary = output.path("summary").asText("").trim();
        if (!summary.isBlank()) {
            for (JsonNode row : sections) {
                if (row.path("name").asText("").toLowerCase(Locale.ROOT).contains("summary")) {
                    if (!summary.equals(row.path("original").asText("").trim())) {
                        summaryChanged = true;
                    }
                    break;
                }
            }
        }

        return new Diagnosis(summaryChanged, experienceChanged, changed, backfilled);
    }

    public static boolean isSubstantiallyTailored(JsonNode output) {
        Diagnosis d = diagnose(output);
        return d.summaryChanged() && d.experienceChanged();
    }
}
