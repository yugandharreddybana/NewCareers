package com.careerops.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

/**
 * Normalises AI job-match JSON to EvaluationReportV2 (schemaVersion=2).
 */
@Component
public final class EvaluationReportValidator {

    public static final int SCHEMA_VERSION = 2;
    public static final double APPLY_THRESHOLD_GO = 4.0;
    public static final double APPLY_THRESHOLD_STRETCH = 3.0;
    public static final double DEFAULT_WEIGHT = 0.1;

    public static String inferMatchTier(int matchPercent) {
        if (matchPercent >= 85) return "PERFECT_MATCH";
        if (matchPercent >= 70) return "STRONG_MATCH";
        if (matchPercent >= 55) return "GOOD_MATCH";
        return "WEAK_MATCH";
    }

    private static final List<DimensionDef> DIMENSIONS = List.of(
        new DimensionDef("role_fit", "Role fit"),
        new DimensionDef("skills_match", "Skills match"),
        new DimensionDef("experience_depth", "Experience depth"),
        new DimensionDef("cv_evidence", "CV evidence"),
        new DimensionDef("location_work_model", "Location & work model"),
        new DimensionDef("compensation", "Compensation"),
        new DimensionDef("sponsorship_visa", "Sponsorship / visa"),
        new DimensionDef("company_stage", "Company stage"),
        new DimensionDef("growth_learning", "Growth & learning"),
        new DimensionDef("culture_signals", "Culture signals")
    );

    private final ObjectMapper mapper;

    public EvaluationReportValidator(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public record NormalizationResult(JsonNode report, boolean valid, String error) {}

    public NormalizationResult normalize(JsonNode raw, String source) {
        if (raw == null || raw.isNull() || !raw.isObject()) {
            return failure("empty or non-object response");
        }
        if (raw.size() == 0
            || (!raw.hasNonNull("matchPercent") && !raw.hasNonNull("overallScore") && !raw.has("dimensions"))) {
            return failure("missing evaluation fields");
        }
        try {
            ObjectNode out = raw.deepCopy();
            out.put("schemaVersion", SCHEMA_VERSION);
            if (source != null && !source.isBlank()) {
                out.put("source", source);
            }
            if (!out.hasNonNull("generatedAt")) {
                out.put("generatedAt", Instant.now().toString());
            }

            ArrayNode dimensions = buildDimensions(out);
            out.set("dimensions", dimensions);

            double applyScore = computeApplyScore(dimensions);
            out.put("applyScore", round1(applyScore));

            if (!out.hasNonNull("overallScore")) {
                out.put("overallScore", (int) Math.round(applyScore * 20));
            }
            if (!out.hasNonNull("matchPercent") && out.has("overallScore")) {
                out.put("matchPercent", out.path("overallScore").asInt());
            }
            if (!out.hasNonNull("matchTier") || out.path("matchTier").asText("").isBlank()) {
                out.put("matchTier", inferMatchTier(out.path("matchPercent").asInt(0)));
            }

            coerceVerdict(out, applyScore);
            out.put("evaluationStatus", "complete");

            return new NormalizationResult(out, true, null);
        } catch (Exception e) {
            return failure(e.getMessage());
        }
    }

    public NormalizationResult normalizeOrPartial(JsonNode raw, String source) {
        NormalizationResult result = normalize(raw, source);
        if (result.valid()) {
            return result;
        }
        ObjectNode partial = raw != null && raw.isObject()
            ? raw.deepCopy()
            : mapper.createObjectNode();
        partial.put("schemaVersion", SCHEMA_VERSION);
        partial.put("evaluationStatus", "partial");
        partial.put("evaluationError", result.error());
        if (source != null) {
            partial.put("source", source);
        }
        return new NormalizationResult(partial, false, result.error());
    }

    private ArrayNode buildDimensions(ObjectNode out) {
        Map<String, JsonNode> byKey = new LinkedHashMap<>();
        JsonNode existing = out.path("dimensions");
        if (existing.isArray()) {
            for (JsonNode d : existing) {
                String key = d.path("key").asText(null);
                if (key != null) {
                    byKey.put(key, d);
                }
            }
        }
        // Legacy v1: flat numeric keys at root
        for (DimensionDef def : DIMENSIONS) {
            if (byKey.containsKey(def.key())) continue;
            if (out.has(def.key()) && out.get(def.key()).isNumber()) {
                ObjectNode dim = mapper.createObjectNode();
                dim.put("key", def.key());
                dim.put("label", def.label());
                dim.put("score", clampScore(out.get(def.key()).asDouble()));
                dim.put("weight", DEFAULT_WEIGHT);
                dim.put("reason", "Legacy score migrated.");
                byKey.put(def.key(), dim);
            }
        }

        ArrayNode arr = mapper.createArrayNode();
        for (DimensionDef def : DIMENSIONS) {
            JsonNode src = byKey.get(def.key());
            ObjectNode dim = mapper.createObjectNode();
            dim.put("key", def.key());
            dim.put("label", def.label());
            double score = src != null ? clampScore(src.path("score").asDouble(3.0)) : 3.0;
            dim.put("score", score);
            dim.put("weight", src != null && src.has("weight")
                ? src.path("weight").asDouble(DEFAULT_WEIGHT)
                : DEFAULT_WEIGHT);
            String reason = src != null ? src.path("reason").asText("") : "";
            if (reason.isBlank()) {
                reason = "No model reason provided.";
            }
            if (reason.length() > 280) {
                reason = reason.substring(0, 277) + "...";
            }
            dim.put("reason", reason);
            arr.add(dim);
        }
        return arr;
    }

    private static double computeApplyScore(ArrayNode dimensions) {
        double sum = 0;
        double weightSum = 0;
        for (JsonNode d : dimensions) {
            double w = d.path("weight").asDouble(DEFAULT_WEIGHT);
            double s = clampScore(d.path("score").asDouble(0));
            sum += s * w;
            weightSum += w;
        }
        return weightSum > 0 ? sum / weightSum : 0;
    }

    private static void coerceVerdict(ObjectNode out, double applyScore) {
        String verdict = out.path("verdict").asText("Stretch role");
        if (applyScore >= APPLY_THRESHOLD_GO) {
            if (verdict.isBlank() || verdict.equalsIgnoreCase("Skip")) {
                out.put("verdict", "Worth applying");
            }
            return;
        }
        if (applyScore >= APPLY_THRESHOLD_STRETCH) {
            if (verdict.toLowerCase().contains("strong")) {
                out.put("verdict", "Stretch role");
            }
            return;
        }
        out.put("verdict", "Skip");
    }

    private static double clampScore(double s) {
        return Math.max(0, Math.min(5, s));
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    private NormalizationResult failure(String msg) {
        return new NormalizationResult(null, false, msg);
    }

    private record DimensionDef(String key, String label) {}
}
