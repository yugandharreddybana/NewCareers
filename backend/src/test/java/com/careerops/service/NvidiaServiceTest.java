package com.careerops.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class NvidiaServiceTest {

    @Mock TokenUsageService tokenUsageService;
    @Mock UserConsentService consentService;

    NvidiaService service;

    @BeforeEach
    void setUp() {
        service = new NvidiaService(
            RestClient.builder(),
            new ObjectMapper(),
            tokenUsageService,
            consentService,
            new SimpleMeterRegistry());
        ReflectionTestUtils.setField(service, "maxTokens", 8192);
        ReflectionTestUtils.setField(service, "model", "test-model");
    }

    @Test
    void resolveSkillName_skillPrefix_extractsSlug() {
        assertThat(invokeResolveSkillName("skill-evaluate")).isEqualTo("evaluate");
        assertThat(invokeResolveSkillName("skill-cover-letter")).isEqualTo("cover-letter");
    }

    @Test
    void resolveSkillName_directSlug_unchanged() {
        assertThat(invokeResolveSkillName("tailor-resume")).isEqualTo("tailor-resume");
    }

    @Test
    void resolveSkillName_infraPipeline_returnsFeatureName() {
        assertThat(invokeResolveSkillName("job-match")).isEqualTo("job-match");
        assertThat(invokeResolveSkillName("cv-normalize")).isEqualTo("cv-normalize");
        assertThat(invokeResolveSkillName(null)).isEqualTo("");
        assertThat(invokeResolveSkillName("")).isEqualTo("");
    }

    @Test
    void buildPlainBody_knownSkill_usesMap() {
        assertThat(maxTokensForSkill("evaluate")).isEqualTo(1200);
        assertThat(maxTokensForSkill("tailor-resume")).isEqualTo(8192);
    }

    @Test
    void buildPlainBody_unknownSkill_defaults4096() {
        assertThat(maxTokensForSkill("job-match")).isEqualTo(4096);
        assertThat(maxTokensForSkill("foo")).isEqualTo(4096);
    }

    private String invokeResolveSkillName(String featureName) {
        return ReflectionTestUtils.invokeMethod(NvidiaService.class, "resolveSkillName", featureName);
    }

    private int maxTokensForSkill(String skillName) {
        ObjectNode body = ReflectionTestUtils.invokeMethod(
                service, "buildPlainBody", "system", "user", skillName);
        return body.path("max_tokens").asInt();
    }
}
