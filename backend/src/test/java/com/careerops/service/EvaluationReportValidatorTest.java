package com.careerops.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class EvaluationReportValidatorTest {

    private EvaluationReportValidator validator;
    private ObjectMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new ObjectMapper();
        validator = new EvaluationReportValidator(mapper);
    }

    @Test
    void validV2WithDimensionsPasses() {
        ObjectNode raw = basePayload();
        String[] keys = {
            "role_fit", "skills_match", "experience_depth", "cv_evidence", "location_work_model",
            "compensation", "sponsorship_visa", "company_stage", "growth_learning", "culture_signals"
        };
        ArrayNode dims = mapper.createArrayNode();
        for (String key : keys) {
            ObjectNode d = mapper.createObjectNode();
            d.put("key", key);
            d.put("label", key);
            d.put("score", 4.5);
            d.put("weight", 0.1);
            d.put("reason", "Strong match.");
            dims.add(d);
        }
        raw.set("dimensions", dims);

        var result = validator.normalize(raw, "test");
        assertTrue(result.valid());
        assertEquals(2, result.report().path("schemaVersion").asInt());
        assertEquals(4.5, result.report().path("applyScore").asDouble(), 0.01);
        assertEquals("complete", result.report().path("evaluationStatus").asText());
    }

    @Test
    void missingDimensionsFilledAndApplyScoreComputed() {
        ObjectNode raw = basePayload();
        raw.put("role_fit", 5.0);
        raw.put("skills_match", 4.0);

        var result = validator.normalize(raw, "daily_delivery");
        assertTrue(result.valid());
        assertEquals(10, result.report().path("dimensions").size());
        assertTrue(result.report().path("applyScore").asDouble() >= 3.0);
    }

    @Test
    void lowApplyScoreForcesSkipVerdict() {
        ObjectNode raw = basePayload();
        raw.put("verdict", "Strong match");
        ArrayNode dims = mapper.createArrayNode();
        ObjectNode low = mapper.createObjectNode();
        low.put("key", "role_fit");
        low.put("label", "Role fit");
        low.put("score", 2.0);
        low.put("weight", 1.0);
        low.put("reason", "Poor fit.");
        dims.add(low);
        raw.set("dimensions", dims);

        var result = validator.normalize(raw, "test");
        assertEquals("Skip", result.report().path("verdict").asText());
    }

    @Test
    void stretchBandCoercesStrongMatch() {
        ObjectNode raw = basePayload();
        raw.put("verdict", "Strong match");
        ArrayNode dims = mapper.createArrayNode();
        ObjectNode d = mapper.createObjectNode();
        d.put("key", "role_fit");
        d.put("label", "Role fit");
        d.put("score", 3.5);
        d.put("weight", 1.0);
        d.put("reason", "Decent.");
        dims.add(d);
        raw.set("dimensions", dims);

        var result = validator.normalize(raw, "test");
        assertEquals("Stretch role", result.report().path("verdict").asText());
    }

    @Test
    void emptyPayloadReturnsPartial() {
        var result = validator.normalizeOrPartial(mapper.nullNode(), "test");
        assertFalse(result.valid());
        assertEquals("partial", result.report().path("evaluationStatus").asText());
    }

    @Test
    void evaluationV2FixtureNormalizesWithSchemaVersion2() throws Exception {
        Path fixture = Path.of("src/test/resources/evaluation-v2-fixture.json");
        JsonNode raw = mapper.readTree(Files.readString(fixture));
        var result = validator.normalize(raw, "test_fixture");
        assertTrue(result.valid());
        assertEquals(2, result.report().path("schemaVersion").asInt());
        assertEquals(10, result.report().path("dimensions").size());
        assertTrue(result.report().path("sections").has("executiveSummary"));
        assertEquals("complete", result.report().path("evaluationStatus").asText());
        assertTrue(result.report().path("applyScore").asDouble() >= 4.0);
    }

    private ObjectNode basePayload() {
        ObjectNode raw = mapper.createObjectNode();
        raw.put("overallScore", 80);
        raw.put("matchPercent", 80);
        raw.put("verdict", "Worth applying");
        raw.put("humanSummary", "Good fit.");
        raw.putArray("matchedSkills").add("Java");
        raw.putArray("unmatchedSkills");
        raw.putArray("cvImprovementTips").add("Add metrics.");
        return raw;
    }
}
