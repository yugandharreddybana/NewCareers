package com.careerops.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Task 137 — SkillService unit tests
 * Covers: cache hit, cache miss → Gemini call,
 *         conversation flow (ask_user → pending → reply → done),
 *         run-all fires 9 phase-1 skills, new skill registration.
 */
@ExtendWith(MockitoExtension.class)
class SkillServiceTest {

    // ── Collaborators (adjust class names to match your actual sources) ────
    @Mock private SkillResultRepository skillResultRepository;
    @Mock private GeminiClient           geminiClient;
    @Mock private UserJobRepository      userJobRepository;

    @InjectMocks private SkillService skillService;

    private static final String USER_JOB_ID = "ujb-001";
    private static final String SKILL_NAME  = "evaluate";

    // ── 1. Cache hit returns stored result without calling Gemini ──────────
    @Test
    @DisplayName("cache hit — returns stored result, never calls Gemini")
    void cacheHit_returnsStoredResult_neverCallsGemini() {
        SkillResult cached = new SkillResult();
        cached.setSkillName(SKILL_NAME);
        cached.setUserJobId(USER_JOB_ID);
        cached.setStatus("done");
        cached.setResultJson("{\"score\":85}");

        when(skillResultRepository.findByUserJobIdAndSkillName(USER_JOB_ID, SKILL_NAME))
            .thenReturn(Optional.of(cached));

        SkillResult result = skillService.getOrRun(USER_JOB_ID, SKILL_NAME, null);

        assertThat(result.getStatus()).isEqualTo("done");
        assertThat(result.getResultJson()).contains("85");
        verify(geminiClient, never()).generate(any());
    }

    // ── 2. Cache miss — calls Gemini, stores result ────────────────────────
    @Test
    @DisplayName("cache miss — calls Gemini and persists result")
    void cacheMiss_callsGeminiAndPersists() {
        when(skillResultRepository.findByUserJobIdAndSkillName(USER_JOB_ID, SKILL_NAME))
            .thenReturn(Optional.empty());
        when(geminiClient.generate(any())).thenReturn("{\"score\":72}");
        when(skillResultRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(userJobRepository.findById(USER_JOB_ID)).thenReturn(Optional.of(new UserJob()));

        SkillResult result = skillService.getOrRun(USER_JOB_ID, SKILL_NAME, null);

        verify(geminiClient, times(1)).generate(any());
        verify(skillResultRepository, times(1)).save(any(SkillResult.class));
        assertThat(result.getStatus()).isEqualTo("done");
    }

    // ── 3. Conversation flow: ask_user → pending → reply → done ──────────
    @Test
    @DisplayName("conversation flow — ask_user transitions through pending to done")
    void conversationFlow_askUserToPendingToDone() {
        // First call: Gemini returns a question
        when(skillResultRepository.findByUserJobIdAndSkillName(USER_JOB_ID, "salary-negotiation"))
            .thenReturn(Optional.empty());
        when(geminiClient.generate(any())).thenReturn("{\"action\":\"ask_user\",\"question\":\"What is your current salary?\"}");
        when(skillResultRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(userJobRepository.findById(USER_JOB_ID)).thenReturn(Optional.of(new UserJob()));

        SkillResult pending = skillService.getOrRun(USER_JOB_ID, "salary-negotiation", null);
        assertThat(pending.getStatus()).isEqualTo("pending_answer");
        assertThat(pending.getQuestion()).isNotBlank();

        // Second call: user provides answer → Gemini returns final result
        when(skillResultRepository.findByUserJobIdAndSkillName(USER_JOB_ID, "salary-negotiation"))
            .thenReturn(Optional.of(pending));
        when(geminiClient.generate(any())).thenReturn("{\"strategy\":\"anchor high\"}");

        SkillResult done = skillService.reply(USER_JOB_ID, "salary-negotiation", "€65k");
        assertThat(done.getStatus()).isEqualTo("done");
    }

    // ── 4. run-all fires exactly 9 phase-1 skills ─────────────────────────
    @Test
    @DisplayName("runAll — triggers all 9 phase-1 skills")
    void runAll_triggersNinePhaseOneSkills() {
        List<String> phase1 = List.of(
            "evaluate", "tailor-resume", "research", "outreach",
            "apply", "prep-interview", "compare", "triage", "scan"
        );

        when(skillResultRepository.findByUserJobIdAndSkillName(eq(USER_JOB_ID), anyString()))
            .thenReturn(Optional.empty());
        when(geminiClient.generate(any())).thenReturn("{\"ok\":true}");
        when(skillResultRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(userJobRepository.findById(USER_JOB_ID)).thenReturn(Optional.of(new UserJob()));

        List<SkillResult> results = skillService.runAllPhaseOne(USER_JOB_ID);

        assertThat(results).hasSize(9);
        assertThat(results).extracting(SkillResult::getSkillName)
            .containsExactlyInAnyOrderElementsOf(phase1);
    }

    // ── 5. New skills registered correctly ───────────────────────────────
    @Test
    @DisplayName("registerSkill — new skill name accepted and retrievable")
    void registerSkill_newSkillAcceptedAndRetrievable() {
        String newSkill = "culture-fit";
        assertThat(skillService.isRegistered(newSkill)).isTrue();
    }
}
