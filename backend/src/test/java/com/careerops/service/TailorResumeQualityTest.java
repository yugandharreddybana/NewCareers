package com.careerops.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TailorResumeQualityTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void detectsMaterialChanges() {
        ObjectNode out = mapper.createObjectNode();
        out.put("summary", "New three sentence summary for the role.");
        ArrayNode sections = out.putArray("sections");
        ObjectNode summary = sections.addObject();
        summary.put("name", "Professional summary");
        summary.put("original", "Old summary line.");
        summary.put("rewritten", "New three sentence summary for the role.");
        ObjectNode exp = sections.addObject();
        exp.put("name", "Professional experience");
        exp.put("original", "Developer Sept 2024 – Present\nAcme | Dublin\n• Built APIs");
        exp.put("rewritten", "Developer Sept 2024 – Present\nAcme | Dublin\n• Shipped Java microservices reducing latency 30%");

        assertThat(TailorResumeQuality.isSubstantiallyTailored(out)).isTrue();
    }

    @Test
    void diagnoseCountsBackfilledSections() {
        ObjectNode out = mapper.createObjectNode();
        ArrayNode sections = out.putArray("sections");
        ObjectNode summary = sections.addObject();
        summary.put("name", "Professional summary");
        summary.put("original", "Old.");
        summary.put("rewritten", "Old.");
        summary.put("rationale", "Preserved from your CV — AI did not return this section; review for JD keywords.");
        ObjectNode exp = sections.addObject();
        exp.put("name", "Professional experience");
        exp.put("original", "Dev\nAcme\n• Same");
        exp.put("rewritten", "Dev\nAcme\n• Same");

        TailorResumeQuality.Diagnosis d = TailorResumeQuality.diagnose(out);
        assertThat(d.backfilledSectionCount()).isEqualTo(1);
        assertThat(d.summaryChanged()).isFalse();
        assertThat(d.experienceChanged()).isFalse();
    }

    @Test
    void rejectsEchoedCv() {
        ObjectNode out = mapper.createObjectNode();
        ArrayNode sections = out.putArray("sections");
        ObjectNode exp = sections.addObject();
        exp.put("name", "Professional experience");
        exp.put("original", "• Same bullet");
        exp.put("rewritten", "• Same bullet");

        assertThat(TailorResumeQuality.isSubstantiallyTailored(out)).isFalse();
    }
}
