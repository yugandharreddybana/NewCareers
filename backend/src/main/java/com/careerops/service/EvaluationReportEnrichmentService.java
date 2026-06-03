package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Ensures persisted job evaluations include full EvaluationReportV2 sections (A–F)
 * and dimension rubric when AI output is partial or legacy.
 */
@Service
public class EvaluationReportEnrichmentService {

    private static final List<String> SECTION_KEYS = List.of(
        "executiveSummary",
        "backgroundMatch",
        "positioningStrategy",
        "compensationAndMarket",
        "tailoringPlan",
        "interviewPrep"
    );

    private final StructuredJobEvaluationBuilder structuredBuilder;

    public EvaluationReportEnrichmentService(StructuredJobEvaluationBuilder structuredBuilder) {
        this.structuredBuilder = structuredBuilder;
    }

    public boolean hasAllSections(JsonNode report) {
        if (report == null || !report.isObject()) return false;
        JsonNode sections = report.path("sections");
        if (!sections.isObject()) return false;
        for (String key : SECTION_KEYS) {
            String text = sections.path(key).asText("");
            if (text.isBlank()) return false;
        }
        return true;
    }

    public boolean isCompleteReport(@Nullable JsonNode report) {
        if (report == null || !report.isObject()) return false;
        return hasAllSections(report) && report.path("dimensions").size() >= 10;
    }

    /**
     * Returns a full report, merging structured local sections into any existing AI payload.
     */
    public JsonNode ensureComplete(
            UUID userId,
            Job job,
            UserProfile profile,
            @Nullable String cvText,
            @Nullable JsonNode existing,
            String source) {
        if (isCompleteReport(existing)) {
            return existing;
        }
        JsonNode built = structuredBuilder.build(
            userId, job, profile, cvText, null, source, "complete_local");
        if (existing == null || !existing.isObject()) {
            return built;
        }
        return mergeReports((ObjectNode) existing.deepCopy(), built);
    }

    private JsonNode mergeReports(ObjectNode base, JsonNode built) {
        if (!base.hasNonNull("humanSummary") || base.path("humanSummary").asText("").length()
            < built.path("humanSummary").asText("").length()) {
            base.put("humanSummary", built.path("humanSummary").asText(""));
        }
        if (!base.hasNonNull("verdict") || base.path("verdict").asText("").isBlank()) {
            base.put("verdict", built.path("verdict").asText(""));
        }
        if (!base.hasNonNull("matchPercent")) {
            base.put("matchPercent", built.path("matchPercent").asInt());
        }
        if (!base.hasNonNull("overallScore")) {
            base.put("overallScore", built.path("overallScore").asInt());
        }
        if (!base.hasNonNull("applyScore")) {
            base.put("applyScore", built.path("applyScore").asDouble());
        }
        if (!base.hasNonNull("archetype") && built.hasNonNull("archetype")) {
            base.put("archetype", built.path("archetype").asText());
        }

        ObjectNode sections = base.has("sections") && base.get("sections").isObject()
            ? (ObjectNode) base.get("sections")
            : base.putObject("sections");
        JsonNode builtSections = built.path("sections");
        for (String key : SECTION_KEYS) {
            if (sections.path(key).asText("").isBlank() && builtSections.has(key)) {
                sections.put(key, builtSections.path(key).asText(""));
            }
        }

        if (base.path("dimensions").size() < 10 && built.path("dimensions").isArray()) {
            base.set("dimensions", built.get("dimensions"));
        }

        if (!base.has("nextSteps") || !base.get("nextSteps").isArray() || base.get("nextSteps").isEmpty()) {
            if (built.has("nextSteps")) {
                base.set("nextSteps", built.get("nextSteps"));
            }
        }
        if (!base.has("storyBankCandidates") && built.has("storyBankCandidates")) {
            base.set("storyBankCandidates", built.get("storyBankCandidates"));
        }

        base.put("evaluationStatus", "complete_local");
        if (!base.hasNonNull("schemaVersion")) {
            base.put("schemaVersion", EvaluationReportValidator.SCHEMA_VERSION);
        }
        if (!base.hasNonNull("source") || base.path("source").asText("").isBlank()) {
            base.put("source", built.path("source").asText(sourceFallback(built)));
        }
        return base;
    }

    private static String sourceFallback(JsonNode built) {
        String s = built.path("source").asText("");
        return s.isBlank() ? "enrichment" : s;
    }
}
