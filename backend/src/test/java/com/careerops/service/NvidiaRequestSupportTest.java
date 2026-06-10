package com.careerops.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class NvidiaRequestSupportTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void shouldUseThinking_knownSkills() {
        assertThat(NvidiaRequestSupport.shouldUseThinking("tailor-resume")).isTrue();
        assertThat(NvidiaRequestSupport.shouldUseThinking("cover-letter")).isTrue();
        assertThat(NvidiaRequestSupport.shouldUseThinking("evaluate")).isTrue();
        assertThat(NvidiaRequestSupport.shouldUseThinking("skills-gap-plan")).isTrue();
        assertThat(NvidiaRequestSupport.shouldUseThinking("skill-evaluate")).isTrue();
    }

    @Test
    void shouldUseThinking_fastSkills() {
        assertThat(NvidiaRequestSupport.shouldUseThinking("job-match")).isFalse();
        assertThat(NvidiaRequestSupport.shouldUseThinking("onboarding-cv-parse")).isFalse();
        assertThat(NvidiaRequestSupport.shouldUseThinking("research")).isFalse();
    }

    @Test
    void resolveMaxTokens_thinkingUsesGlobalMax() {
        int tokens = NvidiaRequestSupport.resolveMaxTokens(
                "evaluate", Map.of("research", 2500), 16384, 4096);
        assertThat(tokens).isEqualTo(16384);
    }

    @Test
    void resolveMaxTokens_fastUsesSkillCap() {
        int tokens = NvidiaRequestSupport.resolveMaxTokens(
                "job-match", Map.of("job-match", 1200), 16384, 4096);
        assertThat(tokens).isEqualTo(1200);
    }

    @Test
    void applyNemotronOptions_thinkingSkill_setsReasoningAndTemplate() {
        ObjectNode body = mapper.createObjectNode();
        body.put("max_tokens", 16384);
        var cfg = new NvidiaRequestSupport.NemotronConfig(16384, 8192, 1.0, 0.95);

        NvidiaRequestSupport.applyNemotronOptions(body, "evaluate", false, cfg, mapper);

        assertThat(body.path("temperature").asDouble()).isEqualTo(1.0);
        assertThat(body.path("top_p").asDouble()).isEqualTo(0.95);
        assertThat(body.path("reasoning_budget").asInt()).isEqualTo(8192);
        assertThat(body.path("chat_template_kwargs").path("enable_thinking").asBoolean()).isTrue();
        assertThat(body.path("chat_template_kwargs").has("force_nonempty_content")).isFalse();
    }

    @Test
    void applyNemotronOptions_thinkingWithTools_setsForceNonemptyContent() {
        ObjectNode body = mapper.createObjectNode();
        body.put("max_tokens", 16384);
        var cfg = new NvidiaRequestSupport.NemotronConfig(16384, 8192, 1.0, 0.95);

        NvidiaRequestSupport.applyNemotronOptions(body, "cover-letter", true, cfg, mapper);

        assertThat(body.path("chat_template_kwargs").path("force_nonempty_content").asBoolean()).isTrue();
    }

    @Test
    void applyNemotronOptions_fastSkill_onlyTemperatureAndTopP() {
        ObjectNode body = mapper.createObjectNode();
        body.put("max_tokens", 1200);
        var cfg = new NvidiaRequestSupport.NemotronConfig(16384, 8192, 1.0, 0.95);

        NvidiaRequestSupport.applyNemotronOptions(body, "job-match", false, cfg, mapper);

        assertThat(body.path("temperature").asDouble()).isEqualTo(1.0);
        assertThat(body.path("top_p").asDouble()).isEqualTo(0.95);
        assertThat(body.has("reasoning_budget")).isFalse();
        assertThat(body.has("chat_template_kwargs")).isFalse();
    }
}
