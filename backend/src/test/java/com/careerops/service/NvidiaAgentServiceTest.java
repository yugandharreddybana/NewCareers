package com.careerops.service;

import com.careerops.dto.SkillExecutionContext;
import com.careerops.model.AgentResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NvidiaAgentServiceTest {

    @Mock SkillToolDispatcher dispatcher;
    @Mock TokenUsageService tokenUsageService;
    @Mock UserConsentService consentService;
    @Mock SkillExecutionContextBuilder contextBuilder;

    NvidiaAgentService service;
    UUID userId = UUID.randomUUID();
    UUID userJobId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new NvidiaAgentService(
            dispatcher, new ObjectMapper(), CircuitBreakerRegistry.ofDefaults(),
            tokenUsageService, consentService, contextBuilder,
            new SimpleMeterRegistry());
        ReflectionTestUtils.setField(service, "apiKey", "test-key");
        ReflectionTestUtils.setField(service, "maxTokens", 16384);
        ReflectionTestUtils.setField(service, "reasoningBudget", 8192);
        ReflectionTestUtils.setField(service, "temperature", 1.0);
        ReflectionTestUtils.setField(service, "topP", 0.95);
        service.initRestClient();
    }

    @Test
    void run_buildsContextBeforeConfiguredCheck() {
        ReflectionTestUtils.setField(service, "apiKey", "");
        when(contextBuilder.build(userId, userJobId, "evaluate"))
            .thenReturn(new SkillExecutionContext(userId, userJobId, "evaluate", "INLINE"));

        AgentResult result = service.run("BASE PROMPT", new ObjectMapper().createArrayNode(), userId, userJobId, "evaluate");

        assertThat(result).isInstanceOf(AgentResult.Error.class);
        verify(contextBuilder).build(eq(userId), eq(userJobId), eq("evaluate"));
    }

    @Test
    void resolveMaxTokens_thinkingSkill_usesConfiguredDefault() {
        assertThat(NvidiaAgentService.resolveMaxTokens("evaluate", 16384)).isEqualTo(16384);
    }

    @Test
    void resolveMaxTokens_fastSkill_usesMap() {
        assertThat(NvidiaAgentService.resolveMaxTokens("research", 16384)).isEqualTo(2500);
    }

    @Test
    void resolveMaxTokens_unknownSkill_defaults4096() {
        assertThat(NvidiaAgentService.resolveMaxTokens("help", 8192)).isEqualTo(4096);
    }

    @Test
    void resolveMaxTokens_nullSkill_defaults4096() {
        assertThat(NvidiaAgentService.resolveMaxTokens(null, 8192)).isEqualTo(4096);
    }

    @Test
    void resolveMaxIterations_evaluate_is5() {
        assertThat(NvidiaAgentService.resolveMaxIterations("evaluate", 25)).isEqualTo(5);
    }

    @Test
    void resolveModel_returnsDefaultModel() {
        assertThat(NvidiaAgentService.resolveModel("evaluate", "nvidia/nemotron-3-ultra-550b-a55b"))
            .isEqualTo("nvidia/nemotron-3-ultra-550b-a55b");
    }

    @Test
    void buildRequestBody_thinkingSkill_includesNemotronOptions() {
        ArrayNode messages = new ObjectMapper().createArrayNode();
        ObjectNode body = ReflectionTestUtils.invokeMethod(
            service, "buildRequestBody", "SYS", messages, 16384,
            "nvidia/nemotron-3-ultra-550b-a55b", "evaluate");

        assertThat(body.path("max_tokens").asInt()).isEqualTo(16384);
        assertThat(body.path("model").asText()).isEqualTo("nvidia/nemotron-3-ultra-550b-a55b");
        assertThat(body.path("reasoning_budget").asInt()).isEqualTo(8192);
        assertThat(body.path("chat_template_kwargs").path("enable_thinking").asBoolean()).isTrue();
        assertThat(body.path("chat_template_kwargs").path("force_nonempty_content").asBoolean()).isTrue();
        assertThat(body.path("tools").size()).isEqualTo(1);
        assertThat(body.path("tools").path(0).path("function").path("name").asText()).isEqualTo("ask_user");
    }

    @Test
    void resolveAllowedTools_evaluate_onlyAskUser() {
        assertThat(NvidiaAgentService.resolveAllowedTools("evaluate"))
            .containsExactly("ask_user");
    }

    @Test
    void resolveAllowedTools_unknownSkill_usesDefaultWithoutReadTools() {
        assertThat(NvidiaAgentService.resolveAllowedTools("help"))
            .containsExactlyInAnyOrder("web_search", "web_fetch", "ask_user");
    }

    @Test
    void resolveAllowedTools_nullSkill_usesDefault() {
        assertThat(NvidiaAgentService.resolveAllowedTools(null))
            .isEqualTo(NvidiaAgentService.resolveAllowedTools("help"));
    }

    @Test
    void buildToolDefinitions_filtersToAllowedSet() {
        Set<String> allowed = Set.of("ask_user", "save_resume_html");
        JsonNode tools = ReflectionTestUtils.invokeMethod(service, "buildToolDefinitions", allowed);

        assertThat(tools.isArray()).isTrue();
        assertThat(tools.size()).isEqualTo(2);
        List<String> names = StreamSupport.stream(tools.spliterator(), false)
            .map(t -> t.path("function").path("name").asText())
            .toList();
        assertThat(names).containsExactlyInAnyOrder("ask_user", "save_resume_html");
    }

    @Test
    void buildRequestBody_fastSkill_noThinkingOptions() {
        ArrayNode messages = new ObjectMapper().createArrayNode();
        ObjectNode body = ReflectionTestUtils.invokeMethod(
            service, "buildRequestBody", "SYS", messages, 2500,
            "nvidia/nemotron-3-ultra-550b-a55b", "research");

        assertThat(body.has("reasoning_budget")).isFalse();
        assertThat(body.has("chat_template_kwargs")).isFalse();
        assertThat(body.path("tools").size()).isEqualTo(3);
        List<String> names = StreamSupport.stream(body.path("tools").spliterator(), false)
            .map(t -> t.path("function").path("name").asText())
            .toList();
        assertThat(names).containsExactlyInAnyOrder("web_search", "web_fetch", "ask_user");
    }

    @Test
    void resolveAllowedTools_noSkillIncludesReadProfileResumeJob() {
        for (String skill : java.util.Arrays.asList("tailor-resume", "cover-letter", "evaluate", "research", "prep-interview", "compare", "help", null)) {
            Set<String> tools = NvidiaAgentService.resolveAllowedTools(skill);
            assertThat(tools).doesNotContain("read_profile", "read_resume", "read_job");
        }
    }
}
