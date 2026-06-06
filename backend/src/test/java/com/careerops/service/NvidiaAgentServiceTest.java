package com.careerops.service;

import com.careerops.model.AgentResult;
import com.careerops.model.Job;
import com.careerops.model.UserJob;
import com.careerops.model.UserProfile;
import com.careerops.repository.JobRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
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
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NvidiaAgentServiceTest {

    @Mock SkillToolDispatcher dispatcher;
    @Mock TokenUsageService tokenUsageService;
    @Mock UserConsentService consentService;
    @Mock UserProfileRepository profileRepository;
    @Mock CvService cvService;
    @Mock JobRepository jobRepository;
    @Mock UserJobRepository userJobRepository;

    NvidiaAgentService service;
    UUID userId = UUID.randomUUID();
    UUID userJobId = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new NvidiaAgentService(
            dispatcher, new ObjectMapper(), CircuitBreakerRegistry.ofDefaults(),
            tokenUsageService, consentService,
            profileRepository, cvService, jobRepository, userJobRepository,
            new SimpleMeterRegistry());
        ReflectionTestUtils.setField(service, "apiKey", "test-key");
    }

    @Test
    void buildEnrichedSystemPrompt_includesProfileCvAndJob() {
        UserProfile profile = new UserProfile();
        profile.setTargetRoles(new String[]{"Backend Engineer"});
        profile.setTechStack(new String[]{"Java", "Spring"});
        profile.setLocation("Dublin");
        profile.setSalaryMin(80000);
        profile.setSalaryMax(100000);
        profile.setExperienceLevel("senior");
        profile.setSponsorshipRequired(false);
        when(profileRepository.findByUserId(userId)).thenReturn(Optional.of(profile));
        when(cvService.activeCvText(userId)).thenReturn("Jane Doe\n5 years Java");

        UserJob uj = new UserJob();
        uj.setJobId(jobId);
        Job job = new Job();
        job.setTitle("Senior Java Dev");
        job.setCompany("Acme");
        job.setLocation("Dublin");
        job.setDescription("Build APIs");
        when(userJobRepository.findByIdAndUserId(userJobId, userId)).thenReturn(Optional.of(uj));
        when(jobRepository.findById(jobId)).thenReturn(Optional.of(job));

        String result = ReflectionTestUtils.invokeMethod(
            service, "buildEnrichedSystemPrompt", "BASE", userId, userJobId);

        assertThat(result).startsWith("BASE");
        assertThat(result).contains("PRE-LOADED CONTEXT");
        assertThat(result).contains("do NOT call read_profile");
        assertThat(result).contains("USER PROFILE");
        assertThat(result).contains("target_roles: [Backend Engineer]");
        assertThat(result).contains("USER CV/RESUME");
        assertThat(result).contains("Jane Doe");
        assertThat(result).contains("JOB POSTING");
        assertThat(result).contains("title: Senior Java Dev");
        assertThat(result).contains("company: Acme");
    }

    @Test
    void buildEnrichedSystemPrompt_truncatesLongCv() {
        when(profileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(cvService.activeCvText(userId)).thenReturn("x".repeat(7000));
        String result = ReflectionTestUtils.invokeMethod(
            service, "buildEnrichedSystemPrompt", "BASE", userId, null);
        assertThat(result).contains("...[CV truncated]");
        assertThat(result).doesNotContain("x".repeat(7000));
    }

    @Test
    void buildEnrichedSystemPrompt_survivesRepositoryFailure() {
        when(profileRepository.findByUserId(userId)).thenThrow(new RuntimeException("db down"));
        when(cvService.activeCvText(userId)).thenReturn("cv");
        String result = ReflectionTestUtils.invokeMethod(
            service, "buildEnrichedSystemPrompt", "BASE", userId, null);
        assertThat(result).contains("USER CV/RESUME");
        assertThat(result).doesNotContain("USER PROFILE");
    }

    @Test
    void run_enrichesPromptBeforeConfiguredCheck() {
        ReflectionTestUtils.setField(service, "apiKey", "");
        when(profileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(cvService.activeCvText(userId)).thenReturn("cv text");

        AgentResult result = service.run("BASE PROMPT", new ObjectMapper().createArrayNode(), userId, null, null);

        assertThat(result).isInstanceOf(AgentResult.Error.class);
        verify(profileRepository).findByUserId(userId);
        verify(cvService).activeCvText(userId);
    }

    @Test
    void resolveMaxTokens_knownSkill_usesMap() {
        assertThat(NvidiaAgentService.resolveMaxTokens("evaluate", 8192)).isEqualTo(1200);
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
    void resolveModel_evaluate_uses8bOverride() {
        assertThat(NvidiaAgentService.resolveModel("evaluate", "meta/llama-3.3-70b-instruct"))
            .isEqualTo("meta/llama-3.1-8b-instruct");
    }

    @Test
    void buildRequestBody_usesEffectiveTokensAndModel() {
        ReflectionTestUtils.setField(service, "model", "meta/llama-3.3-70b-instruct");
        ArrayNode messages = new ObjectMapper().createArrayNode();
        ObjectNode body = ReflectionTestUtils.invokeMethod(
            service, "buildRequestBody", "SYS", messages, 1200, "meta/llama-3.1-8b-instruct", "evaluate");

        assertThat(body.path("max_tokens").asInt()).isEqualTo(1200);
        assertThat(body.path("model").asText()).isEqualTo("meta/llama-3.1-8b-instruct");
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
    void buildRequestBody_research_includesWebTools() {
        ArrayNode messages = new ObjectMapper().createArrayNode();
        ObjectNode body = ReflectionTestUtils.invokeMethod(
            service, "buildRequestBody", "SYS", messages, 2500, "meta/llama-3.3-70b-instruct", "research");

        assertThat(body.path("tools").size()).isEqualTo(3);
        List<String> names = StreamSupport.stream(body.path("tools").spliterator(), false)
            .map(t -> t.path("function").path("name").asText())
            .toList();
        assertThat(names).containsExactlyInAnyOrder("web_search", "web_fetch", "ask_user");
    }

    @Test
    void resolveAllowedTools_noSkillIncludesReadProfileResumeJob() {
        for (String skill : List.of("tailor-resume", "cover-letter", "evaluate", "research", "prep-interview", "compare", "help", null)) {
            Set<String> tools = NvidiaAgentService.resolveAllowedTools(skill);
            assertThat(tools).doesNotContain("read_profile", "read_resume", "read_job");
        }
    }
}
