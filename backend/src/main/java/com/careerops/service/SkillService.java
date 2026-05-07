package com.careerops.service;

import org.jspecify.annotations.Nullable;

import com.careerops.dto.RunAllSkillsResponse;
import com.careerops.dto.SkillRunResponse;
import com.careerops.dto.SkillStartRequest;
import com.careerops.exception.ApiException;
import org.springframework.http.HttpStatus;
import com.careerops.model.AgentResult;
import com.careerops.model.Notification;
import com.careerops.model.SkillConversation;
import com.careerops.model.SkillRun;
import com.careerops.repository.SkillConversationRepository;
import com.careerops.repository.SkillRunRepository;
import com.careerops.repository.BatchSkillRunRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.JobRepository;
import com.careerops.model.BatchSkillRun;
import com.careerops.service.skills.SkillHandlerRegistry;
import io.micrometer.core.instrument.MeterRegistry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Orchestrates all 14 CareerOps skills (9 Phase 1 + 5 Phase 2).
 *
 * Routing:
 *   Phase 1 skills  → ClaudeAgentService (multi-turn agentic tool loop)
 *   Phase 2 skills  → SkillHandlerRegistry (Claude direct single-turn, structured JSON)
 *
 * Flow (Phase 1):
 *   1. Validate profile completeness (ProfileValidator)
 *   2. Check TTL cache (SkillRunRepository)
 *   3. Build system prompt (SkillPromptLibrary)
 *   4. Run Claude agentic loop (ClaudeAgentService)
 *   5. Handle result: Done | NeedsAnswer | Error
 *   6. Save SkillRun with appropriate TTL
 *
 * Flow (Phase 2):
 *   1. Validate profile completeness
 *   2. Delegate entirely to SkillHandlerRegistry (cache check + handler + persist)
 *
 * Section 8 — Task 88:
 *   On a successful Done result (Phase 1 only, since Phase 2 returns before
 *   reaching handleAgentResult), fires:
 *     - sendSkillCompleteEmail(userId, skillDisplayName, jobTitle)
 *     - notificationService.create(..., SKILL_COMPLETE, ...)
 *   Both are non-fatal: wrapped in try/catch so a notification failure
 *   never rolls back the skill save.
 */
@Service
public class SkillService {

    private static final Logger log = LoggerFactory.getLogger(SkillService.class);

    /** TTL cache for Phase 1 skills only */
    private static final Map<String, Integer> CACHE_TTL_DAYS = Map.of(
        "evaluate",       7,
        "research",       1,
        "prep-interview", 3
    );

    /** Human-readable display names for the Phase 1 skills shown in notifications/emails. */
    private static final Map<String, String> SKILL_DISPLAY_NAMES = Map.of(
        "evaluate",       "CV Evaluation",
        "research",       "Company Research",
        "prep-interview", "Interview Prep"
    );

    @PersistenceContext
    private EntityManager em;

    private final ClaudeAgentService          claude;
    private final SkillPromptLibrary          prompts;
    private final ProfileValidator            validator;
    private final SkillRunRepository          skillRuns;
    private final BatchSkillRunRepository     batchRuns; // 3.055
    private final UserJobRepository           userJobs;  // 3.056
    private final JobRepository               jobs;      // 3.056
    private final SkillConversationRepository conversations;
    private final SkillHandlerRegistry        registry;
    private final ObjectMapper                mapper;
    private final ResendEmailService          emailService;
    private final NotificationService         notificationService;
    private final TokenUsageService           tokenUsageService;
    private final MeterRegistry               meterRegistry; // 3.060

    // 3.055 - Executor for background batch runs
    private final java.util.concurrent.ExecutorService batchExecutor = java.util.concurrent.Executors.newFixedThreadPool(4);

    @Value("${skill.conversation.expire.minutes:30}")
    private int conversationExpireMinutes;

    @Value("${ai.daily.token.budget:500000}")
    private long dailyTokenBudget;

    public SkillService(
            ClaudeAgentService claude,
            SkillPromptLibrary prompts,
            ProfileValidator validator,
            SkillRunRepository skillRuns,
            BatchSkillRunRepository batchRuns,
            UserJobRepository userJobs,
            JobRepository jobs,
            SkillConversationRepository conversations,
            SkillHandlerRegistry registry,
            ObjectMapper mapper,
            ResendEmailService emailService,
            NotificationService notificationService,
            TokenUsageService tokenUsageService,
            MeterRegistry meterRegistry) {
        this.claude               = claude;
        this.prompts              = prompts;
        this.validator            = validator;
        this.skillRuns            = skillRuns;
        this.batchRuns            = batchRuns;
        this.userJobs             = userJobs;
        this.jobs                 = jobs;
        this.conversations        = conversations;
        this.registry             = registry;
        this.mapper               = mapper;
        this.emailService         = emailService;
        this.notificationService  = notificationService;
        this.tokenUsageService    = tokenUsageService;
        this.meterRegistry        = meterRegistry;
    }

    // ================================================================
    // START A SKILL
    // ================================================================

    @Transactional(timeout = 10)
    public SkillRunResponse startSkill(SkillStartRequest req, UUID userId) {
        String skill     = req.skillName();
        UUID   userJobId = req.userJobId();

        log.info("startSkill: skill={}, userId={}, userJobId={}", skill, userId, userJobId);

        // Daily token budget check
        if (tokenUsageService.hasExceededBudget(userId, dailyTokenBudget)) {
            log.warn("Daily token budget exhausted for userId={}", userId);
            try {
                notificationService.create(
                    userId,
                    "BILLING_ALERT",
                    "Daily token budget exhausted",
                    "You have exhausted your daily token usage limit. Please try again tomorrow.",
                    Map.of()
                );
            } catch (Exception e) {
                log.warn("Failed to trigger billing alert notification: {}", e.getMessage());
            }
            return SkillRunResponse.error(skill, "Daily token budget exhausted. Please try again tomorrow.");
        }

        // Step 1: Profile validation (applies to all 14 skills)
        List<String> missing = validator.validateForSkill(userId, skill);
        if (!missing.isEmpty()) {
            log.debug("Profile incomplete for skill={}: {}", skill, missing);
            return SkillRunResponse.profileIncomplete(skill, missing);
        }

        // Step 2: Phase 2 routing — delegate to SkillHandlerRegistry
        if (registry.handles(skill)) {
            log.info("Routing Phase 2 skill={} to SkillHandlerRegistry", skill);
            return registry.execute(skill, userId, userJobId);
        }

        // Step 3: Phase 1 — TTL cache check
        if (userJobId != null && CACHE_TTL_DAYS.containsKey(skill)) {
            Optional<SkillRun> cached = skillRuns.findValidCachedRun(userId, userJobId, skill, Instant.now());
            if (cached.isPresent()) {
                log.debug("Cache hit for Phase 1 skill={}, userId={}", skill, userId);
                return SkillRunResponse.result(skill, cached.get().getOutput());
            }
        }

        // Step 4: Phase 1 — Claude agentic loop
        String systemPrompt = prompts.buildFullSystemPrompt(skill, userId);
        ArrayNode messages  = buildInitialMessages(req, userId);

        return handleAgentResult(
                claude.run(systemPrompt, messages, userId, userJobId),
                skill, userId, userJobId, messages
        );
    }

    // ================================================================
    // RESUME A PAUSED CONVERSATION (Phase 1 only — Phase 2 is single-turn)
    // ================================================================

    @Transactional(timeout = 10)
    public SkillRunResponse resumeConversation(UUID conversationId, String answer, UUID userId) {
        log.info("resumeConversation: id={}, userId={}", conversationId, userId);

        // 3.061 — Length limit to prevent cost amplification
        if (answer != null && answer.length() > 4000) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Answer is too long (max 4000 chars)");
        }

        // 3.059 — Use pessimistic lock to prevent concurrent resumes
        SkillConversation conv = conversations.findByIdAndUserIdForUpdate(conversationId, userId)
                .orElse(null);

        if (conv == null) {
            return SkillRunResponse.error("unknown", "Conversation not found.");
        }

        if (conv.getExpiresAt().isBefore(Instant.now())) {
            conv.setStatus("expired");
            conversations.save(conv);
            return SkillRunResponse.error(conv.getSkill(),
                    "This conversation has expired. Please start the skill again.");
        }

        ArrayNode history = (ArrayNode) conv.getMessages();

        ObjectNode toolResultMsg = mapper.createObjectNode();
        toolResultMsg.put("role", "user");
        ArrayNode toolResultContent = mapper.createArrayNode();
        ObjectNode toolResult = mapper.createObjectNode();
        toolResult.put("type",        "tool_result");
        toolResult.put("tool_use_id", conv.getToolUseId());
        toolResult.put("content",     answer.isBlank() ? "[User skipped this question]" : answer);
        toolResultContent.add(toolResult);
        toolResultMsg.set("content", toolResultContent);
        history.add(toolResultMsg);

        String systemPrompt = prompts.buildFullSystemPrompt(conv.getSkill(), userId);
        AgentResult result  = claude.run(systemPrompt, history, userId, conv.getUserJobId());

        conv.setStatus("completed");
        conversations.save(conv);

        return handleAgentResult(result, conv.getSkill(), userId, conv.getUserJobId(), history);
    }

    // ================================================================
    // RUN ALL 14 SKILLS (Synchronous)
    // ================================================================

    @Transactional(timeout = 10)
    public RunAllSkillsResponse runAllSkills(UUID userId, UUID userJobId) {
        log.info("runAllSkills: userId={}, userJobId={}", userId, userJobId);
        Map<String, SkillRunResponse> results = new LinkedHashMap<>();
        int succeeded = 0;
        int failed = 0;
        int pending = 0;

        for (String skill : SkillPromptLibrary.ALL_SKILLS) {
            try {
                SkillRunResponse resp = startSkill(new SkillStartRequest(skill, userJobId, null, null, null, null, null), userId);
                results.put(skill, resp);
                if (resp.type() == SkillRunResponse.Type.RESULT) {
                    succeeded++;
                } else if (resp.type() == SkillRunResponse.Type.QUESTION) {
                    pending++;
                } else if (resp.type() == SkillRunResponse.Type.PROFILE_INCOMPLETE) {
                    // Short-circuit: if a skill returns PROFILE_INCOMPLETE, abort and return single response listing missing fields.
                    results.clear();
                    results.put(skill, resp);
                    return new RunAllSkillsResponse(SkillPromptLibrary.ALL_SKILLS.size(), 0, 1, 0, results);
                } else {
                    failed++;
                }
            } catch (Exception e) {
                log.error("Sync run-all: skill {} failed: {}", skill, e.getMessage());
                results.put(skill, SkillRunResponse.error(skill, e.getMessage()));
                failed++;
            }
        }
        return new RunAllSkillsResponse(SkillPromptLibrary.ALL_SKILLS.size(), succeeded, failed, pending, results);
    }

    // ================================================================
    // RUN ALL 14 SKILLS (Asynchronous)
    // ================================================================

    @Transactional(timeout = 10)
    public com.careerops.dto.BatchRunStatusResponse runAllSkillsAsync(UUID userId, UUID userJobId) {
        BatchSkillRun batch = BatchSkillRun.builder()
            .userId(userId)
            .userJobId(userJobId)
            .status("in_progress")
            .totalSkills(SkillPromptLibrary.ALL_SKILLS.size())
            .completedSkills(0)
            .build();
        batch = batchRuns.save(batch);

        final UUID batchId = batch.getId();
        batchExecutor.submit(() -> {
            int comp = 0;
            for (String s : SkillPromptLibrary.ALL_SKILLS) {
                try {
                    startSkill(new SkillStartRequest(s, userJobId, null, null, null, null, null), userId);
                } catch (Exception e) {
                    log.error("Batch {}: skill {} failed: {}", batchId, s, e.getMessage());
                    // 3.060 — Emit metric for failure visibility
                    meterRegistry.counter("skill.run.failed", "skill", s).increment();
                } finally {
                    comp++;
                    final int curr = comp;
                    batchRuns.findById(batchId).ifPresent(b -> { b.setCompletedSkills(curr); batchRuns.save(b); });
                }
            }
            batchRuns.findById(batchId).ifPresent(b -> { b.setStatus("completed"); batchRuns.save(b); });
        });

        return new com.careerops.dto.BatchRunStatusResponse(
            batchId, userJobId, "in_progress", SkillPromptLibrary.ALL_SKILLS.size(), 0, Instant.now(), Map.of()
        );
    }

    public com.careerops.dto.BatchRunStatusResponse getBatchStatus(UUID userId, UUID batchId) {
        BatchSkillRun b = batchRuns.findByIdAndUserId(batchId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Batch not found"));

        List<SkillRun> runs = skillRuns.findAllByUserIdAndUserJobIdOrderByCreatedAtDesc(userId, b.getUserJobId());
        Map<String, SkillRunResponse> results = new LinkedHashMap<>();
        for (SkillRun r : runs) {
            if (r.getCreatedAt().isAfter(b.getCreatedAt()) && !results.containsKey(r.getSkill())) {
                results.put(r.getSkill(), SkillRunResponse.result(r.getSkill(), r.getOutput()));
            }
        }
        return new com.careerops.dto.BatchRunStatusResponse(b.getId(), b.getUserJobId(), b.getStatus(), b.getTotalSkills(), b.getCompletedSkills(), b.getCreatedAt(), results);
    }

    // ================================================================
    // GET LAST RUN
    // ================================================================

    public SkillRunResponse getLastRun(UUID userId, UUID userJobId, String skillName) {
        return skillRuns
                .findFirstByUserIdAndUserJobIdAndSkillOrderByCreatedAtDesc(userId, userJobId, skillName)
                .map(sr -> SkillRunResponse.result(skillName, sr.getOutput()))
                .orElse(SkillRunResponse.error(skillName,
                        "No previous run found. Run the skill first."));
    }

    // ================================================================
    // PRIVATE HELPERS
    // ================================================================

    private SkillRunResponse handleAgentResult(
            AgentResult result,
            String skill,
            UUID userId,
            UUID userJobId,
            ArrayNode messages) {

        return switch (result) {

            case AgentResult.Done done -> {
                JsonNode output = parseOutput(done.text());

                // 3.058 — 'Upsert' logic: delete old run for this combo to prevent table bloat
                skillRuns.deleteByUserIdAndUserJobIdAndSkill(userId, userJobId, skill);

                SkillRun run = SkillRun.builder()
                        .userId(userId)
                        .userJobId(userJobId)
                        .skill(skill)
                        .input(mapper.createObjectNode())
                        .output(output)
                        .expiresAt(computeExpiry(skill))
                        .build();
                skillRuns.save(run);

                log.info("Skill {} completed and saved for userId={}", skill, userId);

                // Section 8 — Task 88: fire skill-complete email + in-app notification.
                // Non-fatal: any failure here must never roll back the skill save.
                triggerSkillCompleteEvents(skill, userId, userJobId);

                yield SkillRunResponse.result(skill, output);
            }

            case AgentResult.NeedsAnswer needs -> {
                conversations.findByUserIdAndSkillAndUserJobIdAndStatus(
                        userId, skill, userJobId, "pending_answer")
                    .ifPresent(conversations::delete);

                SkillConversation conv = new SkillConversation();
                conv.setUserId(userId);
                conv.setUserJobId(userJobId);
                conv.setSkill(skill);
                conv.setMessages(needs.messages());
                conv.setToolUseId(needs.toolUseId());
                conv.setQuestion(needs.question());
                conv.setStatus("pending_answer");
                conv.setExpiresAt(
                        Instant.now().plus(conversationExpireMinutes, ChronoUnit.MINUTES));
                SkillConversation saved = conversations.save(conv);

                log.info("Skill {} paused for userId={}, waiting for answer", skill, userId);
                yield SkillRunResponse.question(saved.getId(), needs.question(), skill);
            }

            case AgentResult.Error err -> {
                log.warn("Skill {} error for userId={}: {}", skill, userId, err.message());
                // 3.060 — Emit metric for monitoring
                meterRegistry.counter("skill.run.failed", "skill", skill).increment();
                yield SkillRunResponse.error(skill, err.message());
            }
        };
    }

    /**
     * Fires after a Phase 1 skill successfully completes (AgentResult.Done).
     *
     * Sends:
     *   1. Transactional email via ResendEmailService.sendSkillCompleteEmail()
     *   2. In-app SKILL_COMPLETE notification via NotificationService.create()
     *
     * Completely non-fatal — wrapped in try/catch so failures here never
     * affect the skill save or the HTTP response.
     */
    private void triggerSkillCompleteEvents(String skill, UUID userId, UUID userJobId) {
        try {
            String displayName = SKILL_DISPLAY_NAMES.getOrDefault(
                    skill,
                    Character.toUpperCase(skill.charAt(0)) + skill.substring(1)
            );
            String jobTitle = fetchJobTitle(userJobId);

            // Email (Task 88)
            emailService.sendSkillCompleteEmail(userId, displayName, jobTitle);

            // In-app notification
            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("skill", skill);
            meta.put("skillDisplayName", displayName);
            if (userJobId != null) meta.put("userJobId", userJobId.toString());

            notificationService.create(
                    userId,
                    Notification.TYPE_SKILL_COMPLETE,
                    "✨ " + displayName + " complete",
                    displayName + " finished for \"" + jobTitle + "\". View the results in your job detail page.",
                    meta
            );
        } catch (Exception e) {
            log.warn("triggerSkillCompleteEvents non-fatal failure for skill={}, userId={}: {}",
                     skill, userId, e.getMessage());
        }
    }

    /**
     * Fetches the job title for a given userJobId (3.056).
     * Now uses repositories instead of native query with hardcoded schema.
     */
    private String fetchJobTitle(UUID userJobId) {
        if (userJobId == null) return "your application";
        return userJobs.findById(userJobId)
            .flatMap(uj -> jobs.findById(uj.getJobId()))
            .map(com.careerops.model.Job::getTitle)
            .orElse("your application");
    }

    private ArrayNode buildInitialMessages(SkillStartRequest req, UUID userId) {
        ArrayNode messages = mapper.createArrayNode();
        ObjectNode userMsg = mapper.createObjectNode();
        userMsg.put("role", "user");

        StringBuilder content = new StringBuilder();
        content.append("Please run the ").append(req.skillName()).append(" skill for me.\n");

        if (req.channel()    != null) content.append("Channel: ").append(req.channel()).append("\n");
        if (req.tone()       != null) content.append("Tone: ").append(req.tone()).append("\n");
        if (req.step()       != null) content.append("Step: ").append(req.step()).append("\n");
        if (req.scanTarget() != null) content.append("Scan target: ").append(req.scanTarget()).append("\n");

        if (req.compareJobIds() != null && !req.compareJobIds().isEmpty()) {
            content.append("Compare these job IDs: ");
            content.append(String.join(", ",
                    req.compareJobIds().stream().map(UUID::toString).toList()));
            content.append("\n");
        }

        content.append("\nStart by calling read_profile, read_resume, and read_job to gather"
                + " context before generating output.");

        userMsg.put("content", content.toString());
        messages.add(userMsg);
        return messages;
    }

    /**
     * Robustly extracts JSON from agent output (3.057 / 3.072).
     * Now delegates to shared JsonExtractor utility.
     */
    private JsonNode parseOutput(String text) {
        return com.careerops.util.JsonExtractor.extract(text, mapper);
    }

    private @Nullable Instant computeExpiry(String skill) {
        Integer days = CACHE_TTL_DAYS.get(skill);
        return days != null ? Instant.now().plus(days, ChronoUnit.DAYS) : null;
    }
}
