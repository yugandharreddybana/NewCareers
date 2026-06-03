package com.careerops.service;

import org.jspecify.annotations.Nullable;

import com.careerops.dto.RunAllSkillsResponse;
import com.careerops.dto.SkillRunHistoryItem;
import com.careerops.dto.SkillRunResponse;
import com.careerops.dto.SkillStartRequest;
import com.careerops.dto.TailorResumePreviewResponse;
import com.careerops.model.Job;
import com.careerops.model.UserProfile;
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
import com.careerops.repository.UserProfileRepository;
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
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Orchestrates all CareerOps skills using bundled SKILL.md instructions.
 *
 * Routing:
 *   Catalog skills (help, track) → CatalogSkillService
 *   tailor-resume              → dedicated plan + rewrite pipeline (TailorResumeBuilderService)
 *   Phase 2 skills             → SkillHandlerRegistry → SkillMdExecutorService
 *   All other skills           → SkillMdExecutorService (SKILL.md + injected DB context)
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

    private final NvidiaAgentService          nvidia;
    private final SkillPromptLibrary          prompts;
    private final ProfileValidator            validator;
    private final SkillRunRepository          skillRuns;
    private final BatchSkillRunRepository     batchRuns;
    private final UserJobRepository           userJobs;
    private final JobRepository               jobs;
    private final SkillConversationRepository conversations;
    private final SkillHandlerRegistry        registry;
    private final ObjectMapper                mapper;
    private final ResendEmailService          emailService;
    private final NotificationService         notificationService;
    private final TokenUsageService           tokenUsageService;
    private final MeterRegistry               meterRegistry;
    private final CatalogSkillService         catalogSkills;
    private final EvaluationReportValidator   evaluationValidator;
    private final CvHumanScoreService         cvHumanScoreService;
    private final CvService                   cvService;
    private final TailorResumePendingStore    tailorResumePending;
    private final SkillLocalFallbackService   localFallback;
    private final UserProfileRepository       profiles;
    private final EvaluationReportEnrichmentService evaluationEnrichment;
    private final UserJobSkillMatchService       skillMatchService;
    private final TailorResumeBuilderService     tailorResumeBuilder;
    private final SkillMdExecutorService      skillMdExecutor;
    private final TransactionTemplate           readTx;
    private final TransactionTemplate           writeTx;

    private static final int SKILL_RUN_HISTORY_LIMIT = 12;

    private final java.util.concurrent.ExecutorService batchExecutor =
            java.util.concurrent.Executors.newFixedThreadPool(4);

    @Value("${skill.conversation.expire.minutes:30}")
    private int conversationExpireMinutes;

    @Value("${ai.daily.token.budget:500000}")
    private long dailyTokenBudget;

    public SkillService(
            NvidiaAgentService nvidia,
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
            MeterRegistry meterRegistry,
            CatalogSkillService catalogSkills,
            EvaluationReportValidator evaluationValidator,
            CvHumanScoreService cvHumanScoreService,
            CvService cvService,
            TailorResumePendingStore tailorResumePending,
            SkillLocalFallbackService localFallback,
            UserProfileRepository profiles,
            EvaluationReportEnrichmentService evaluationEnrichment,
            UserJobSkillMatchService skillMatchService,
            TailorResumeBuilderService tailorResumeBuilder,
            SkillMdExecutorService skillMdExecutor,
            PlatformTransactionManager transactionManager) {
        this.nvidia               = nvidia;
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
        this.catalogSkills        = catalogSkills;
        this.evaluationValidator  = evaluationValidator;
        this.cvHumanScoreService  = cvHumanScoreService;
        this.cvService            = cvService;
        this.tailorResumePending  = tailorResumePending;
        this.localFallback        = localFallback;
        this.profiles             = profiles;
        this.evaluationEnrichment = evaluationEnrichment;
        this.skillMatchService = skillMatchService;
        this.tailorResumeBuilder = tailorResumeBuilder;
        this.skillMdExecutor = skillMdExecutor;
        this.readTx = new TransactionTemplate(transactionManager);
        this.readTx.setReadOnly(true);
        this.readTx.setTimeout(10);
        this.writeTx = new TransactionTemplate(transactionManager);
        this.writeTx.setTimeout(60);
    }

    // ================================================================
    // START A SKILL
    // ================================================================

    public SkillRunResponse startSkill(SkillStartRequest req, UUID userId) {
        String skill     = req.skillName();
        UUID   userJobId = req.userJobId();

        log.info("startSkill: skill={}, userId={}, userJobId={}, forceRefresh={}",
                skill, userId, userJobId, req.forceRefresh());

        clearStaleConversation(userId, skill, userJobId);
        if (Boolean.TRUE.equals(req.forceRefresh())) {
            invalidateSkillCache(userId, userJobId, skill);
        }

        // Daily token budget check — skills with deterministic/local fallback still run degraded
        if (tokenUsageService.hasExceededBudget(userId, dailyTokenBudget)) {
            log.warn("Daily token budget exhausted for userId={}", userId);
            notifyBudgetExhausted(userId);
            if (!isBudgetDegradableSkill(skill)) {
                return SkillRunResponse.error(skill,
                        "Daily token budget exhausted. Please try again tomorrow.");
            }
            log.info("Skill {} running in budget-degraded mode (deterministic/local fallback)", skill);
        }

        // Step 1: Profile validation (catalog skills skip resume requirements)
        if (!catalogSkills.handles(skill)) {
            List<String> missing = validator.validateForSkill(userId, skill);
            if (!missing.isEmpty()) {
                log.debug("Profile incomplete for skill={}: {}", skill, missing);
                return SkillRunResponse.profileIncomplete(skill, missing);
            }
        }

        // Step 1b: Catalog skills (help, track) — no AI loop
        if (catalogSkills.handles(skill)) {
            return catalogSkills.execute(skill, userId, userJobId);
        }

        // Step 2: Phase 2 routing — delegate to SkillHandlerRegistry
        if (registry.handles(skill)) {
            log.info("Routing Phase 2 skill={} to SkillHandlerRegistry", skill);
            return registry.execute(skill, userId, userJobId, req.forceRefresh());
        }

        if ("compare".equals(skill)
                && (req.compareJobIds() == null || req.compareJobIds().size() < 2)) {
            return SkillRunResponse.error(skill, "Select at least two jobs to compare.");
        }

        // Tailor CV: dedicated writer pipeline (plan → section rewrite), not generic agent tools
        if ("tailor-resume".equals(skill) && userJobId != null) {
            return runDedicatedTailorResume(userId, userJobId, req);
        }

        // Step 4: Unified SKILL.md execution (replaces generic agent tool loop)
        if (userJobId != null && CACHE_TTL_DAYS.containsKey(skill)
                && !Boolean.TRUE.equals(req.forceRefresh())) {
            Optional<SkillRun> cached = readTx.execute(status ->
                    skillRuns.findValidCachedRun(userId, userJobId, skill, Instant.now()));
            if (cached != null && cached.isPresent()) {
                log.debug("Cache hit for skill={}, userId={}", skill, userId);
                return SkillRunResponse.result(skill, cached.get().getOutput());
            }
        }

        return runSkillMdExecution(skill, userId, userJobId, req);
    }

    private SkillRunResponse runSkillMdExecution(
            String skill, UUID userId, UUID userJobId, SkillStartRequest req) {
        JsonNode output = generateSkillMdOutput(skill, userId, userJobId, req);
        if (output == null) {
            return SkillRunResponse.error(skill, "Skill execution failed. Please try again.");
        }

        final JsonNode persistedOutput = output;
        return writeTx.execute(status -> {
            SkillRun run = SkillRun.builder()
                .userId(userId)
                .userJobId(userJobId)
                .skill(skill)
                .input(mapper.createObjectNode())
                .output(persistedOutput)
                .expiresAt(computeExpiry(skill))
                .build();
            skillRuns.save(run);
            log.info("Skill {} completed via SKILL.md for userId={}", skill, userId);
            triggerSkillCompleteEvents(skill, userId, userJobId);
            return SkillRunResponse.result(skill, persistedOutput);
        });
    }

    /** Runs NVIDIA / fallback outside any DB transaction (compare can take 60s+). */
    private JsonNode generateSkillMdOutput(
            String skill, UUID userId, UUID userJobId, SkillStartRequest req) {
        JsonNode output;
        if (!skillMdExecutor.isAvailable()) {
            log.warn("NVIDIA not configured — local fallback for skill={}", skill);
            Optional<AgentResult> fb = localFallback.tryFallback(skill, userId, userJobId, req);
            if (fb.isEmpty() || fb.get() instanceof AgentResult.Error) {
                return null;
            }
            output = parseOutput(((AgentResult.Done) fb.get()).text());
        } else {
            try {
                output = skillMdExecutor.execute(skill, userId, userJobId, req);
            } catch (Exception ex) {
                log.warn("SKILL.md execution failed for skill={}, trying fallback: {}", skill, ex.getMessage());
                Optional<AgentResult> fb = localFallback.tryFallback(skill, userId, userJobId, req);
                if (fb.isPresent() && fb.get() instanceof AgentResult.Done done) {
                    output = parseOutput(done.text());
                } else {
                    meterRegistry.counter("skill.run.failed", "skill", skill).increment();
                    return null;
                }
            }
        }

        if ("evaluate".equals(skill)) {
            output = normalizeEvaluateOutput(output, userJobId);
        }
        return output;
    }

    // ================================================================
    // RESUME A PAUSED CONVERSATION (Phase 1 only — Phase 2 is single-turn)
    // ================================================================

    public SkillRunResponse resumeConversation(UUID conversationId, String answer, UUID userId) {
        log.info("resumeConversation: id={}, userId={}", conversationId, userId);

        if (answer != null && answer.length() > 4000) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Answer is too long (max 4000 chars)");
        }

        SkillConversation conv = writeTx.execute(status ->
                conversations.findByIdAndUserIdForUpdate(conversationId, userId).orElse(null));

        if (conv == null) {
            return SkillRunResponse.error("unknown", "Conversation not found.");
        }

        if (conv.getExpiresAt().isBefore(Instant.now())) {
            writeTx.executeWithoutResult(status -> {
                conv.setStatus("expired");
                conversations.save(conv);
            });
            return SkillRunResponse.error(conv.getSkill(),
                    "This conversation has expired. Please start the skill again.");
        }

        String skill = conv.getSkill();
        UUID userJobId = conv.getUserJobId();
        String supplement = "## User answer to prior question\n"
            + (answer == null || answer.isBlank() ? "[User skipped this question]" : answer.trim());

        writeTx.executeWithoutResult(status -> {
            conv.setStatus("completed");
            conversations.save(conv);
        });

        SkillStartRequest req = new SkillStartRequest(skill, userJobId, null, null, null, null, null, null);
        return writeTx.execute(status -> {
            JsonNode output = skillMdExecutor.execute(skill, userId, userJobId, req, supplement);
            if ("evaluate".equals(skill)) {
                output = normalizeEvaluateOutput(output, userJobId);
            }
            SkillRun run = SkillRun.builder()
                .userId(userId)
                .userJobId(userJobId)
                .skill(skill)
                .input(mapper.createObjectNode())
                .output(output)
                .expiresAt(computeExpiry(skill))
                .build();
            skillRuns.save(run);
            triggerSkillCompleteEvents(skill, userId, userJobId);
            return SkillRunResponse.result(skill, output);
        });
    }

    // ================================================================
    // RUN ALL 14 SKILLS (Synchronous)
    // ================================================================

    public RunAllSkillsResponse runAllSkills(UUID userId, UUID userJobId) {
        log.info("runAllSkills: userId={}, userJobId={}", userId, userJobId);
        Map<String, SkillRunResponse> results = new LinkedHashMap<>();
        int succeeded = 0;
        int failed = 0;
        int pending = 0;

        for (String skill : SkillPromptLibrary.ALL_SKILLS) {
            try {
                SkillRunResponse resp = startSkill(
                        new SkillStartRequest(skill, userJobId, null, null, null, null, null, null), userId);
                results.put(skill, resp);
                if (resp.type() == SkillRunResponse.Type.RESULT) {
                    succeeded++;
                } else if (resp.type() == SkillRunResponse.Type.QUESTION) {
                    pending++;
                } else if (resp.type() == SkillRunResponse.Type.PROFILE_INCOMPLETE) {
                    results.clear();
                    results.put(skill, resp);
                    return new RunAllSkillsResponse(
                            SkillPromptLibrary.ALL_SKILLS.size(), 0, 1, 0, results);
                } else {
                    failed++;
                }
            } catch (Exception e) {
                log.error("Sync run-all: skill {} failed: {}", skill, e.getMessage());
                results.put(skill, SkillRunResponse.error(skill, e.getMessage()));
                failed++;
            }
        }
        return new RunAllSkillsResponse(
                SkillPromptLibrary.ALL_SKILLS.size(), succeeded, failed, pending, results);
    }

    // ================================================================
    // RUN ALL 14 SKILLS (Asynchronous)
    // ================================================================

    public com.careerops.dto.BatchRunStatusResponse runAllSkillsAsync(UUID userId, UUID userJobId) {
        BatchSkillRun batch = writeTx.execute(status -> batchRuns.save(BatchSkillRun.builder()
            .userId(userId)
            .userJobId(userJobId)
            .status("in_progress")
            .totalSkills(SkillPromptLibrary.ALL_SKILLS.size())
            .completedSkills(0)
            .build()));

        final UUID batchId = batch.getId();
        batchExecutor.submit(() -> {
            int comp = 0;
            for (String s : SkillPromptLibrary.ALL_SKILLS) {
                try {
                    startSkill(new SkillStartRequest(s, userJobId, null, null, null, null, null, null), userId);
                } catch (Exception e) {
                    log.error("Batch {}: skill {} failed: {}", batchId, s, e.getMessage());
                    meterRegistry.counter("skill.run.failed", "skill", s).increment();
                } finally {
                    comp++;
                    final int curr = comp;
                    writeTx.executeWithoutResult(status ->
                            batchRuns.findById(batchId).ifPresent(b -> {
                                b.setCompletedSkills(curr);
                                batchRuns.save(b);
                            }));
                }
            }
            writeTx.executeWithoutResult(status ->
                    batchRuns.findById(batchId).ifPresent(b -> {
                        b.setStatus("completed");
                        batchRuns.save(b);
                    }));
        });

        return new com.careerops.dto.BatchRunStatusResponse(
            batchId, userJobId, "in_progress",
            SkillPromptLibrary.ALL_SKILLS.size(), 0, Instant.now(), Map.of()
        );
    }

    public com.careerops.dto.BatchRunStatusResponse getBatchStatus(UUID userId, UUID batchId) {
        BatchSkillRun b = batchRuns.findByIdAndUserId(batchId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Batch not found"));

        List<SkillRun> runs = skillRuns
                .findAllByUserIdAndUserJobIdOrderByCreatedAtDesc(userId, b.getUserJobId());
        Map<String, SkillRunResponse> results = new LinkedHashMap<>();
        for (SkillRun r : runs) {
            if (r.getCreatedAt().isAfter(b.getCreatedAt()) && !results.containsKey(r.getSkill())) {
                results.put(r.getSkill(), SkillRunResponse.result(r.getSkill(), r.getOutput()));
            }
        }
        return new com.careerops.dto.BatchRunStatusResponse(
                b.getId(), b.getUserJobId(), b.getStatus(),
                b.getTotalSkills(), b.getCompletedSkills(), b.getCreatedAt(), results);
    }

    // ================================================================
    // GET LAST RUN
    // ================================================================

    /**
     * Returns the most recent saved run, or empty when the user has never completed this skill
     * for the job. Callers should treat empty as "run fresh" — not an error condition.
     */
    public Optional<SkillRunResponse> findLastRun(UUID userId, UUID userJobId, String skillName) {
        return skillRuns
                .findFirstByUserIdAndUserJobIdAndSkillOrderByCreatedAtDesc(userId, userJobId, skillName)
                .map(run -> SkillRunResponse.result(skillName, run.getOutput()));
    }

    /** Skill names that have at least one saved run for this job (for UI tick marks after reload). */
    public List<String> listCompletedSkills(UUID userId, UUID userJobId) {
        return skillRuns.findDistinctSkillsByUserIdAndUserJobId(userId, userJobId);
    }

    /**
     * Recent runs for a job skill (newest first), for version stack / diff UI.
     */
    public Optional<TailorResumePreviewResponse> getTailoredResumePreview(UUID userId, UUID userJobId) {
        return readTx.execute(status -> skillRuns
                .findFirstByUserIdAndUserJobIdAndSkillOrderByCreatedAtDesc(userId, userJobId, "tailor-resume")
                .map(run -> {
                    JsonNode output = run.getOutput();
                    UserProfile profile = loadProfile(userId);
                    Job job = loadJob(userJobId);
                    String html = tailorResumeBuilder.renderPreviewFromOutput(profile, null, job, output);
                    if (html.isBlank() && output != null) {
                        html = output.path("resumeHtml").asText("");
                    }
                    if (html.isBlank() && run.getResumeHtml() != null) {
                        html = run.getResumeHtml();
                    }
                    String tailored = output != null
                            ? tailorResumeBuilder.tailoredMarkdownFromOutput(output)
                            : "";
                    String baseline = output != null
                            ? output.path("baselineMarkdown").asText("")
                            : "";
                    return new TailorResumePreviewResponse(html, tailored, baseline);
                }));
    }

    public List<SkillRunHistoryItem> listRunHistory(UUID userId, UUID userJobId, String skillName) {
        return skillRuns
                .findByUserIdAndUserJobIdAndSkillOrderByCreatedAtDesc(
                        userId, userJobId, skillName, PageRequest.of(0, SKILL_RUN_HISTORY_LIMIT))
                .stream()
                .map(run -> new SkillRunHistoryItem(run.getId(), run.getCreatedAt(), run.getOutput()))
                .toList();
    }

    /** @deprecated Prefer {@link #findLastRun}; kept for internal callers that expect an exception. */
    public SkillRunResponse getLastRun(UUID userId, UUID userJobId, String skillName) {
        return findLastRun(userId, userJobId, skillName)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "No previous run found for this skill."));
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
                if ("evaluate".equals(skill)) {
                    output = normalizeEvaluateOutput(output, userJobId);
                }
                TailorResumePendingStore.Pending pendingResume = null;
                if ("tailor-resume".equals(skill) && userJobId != null) {
                    pendingResume = tailorResumePending.take(userId, userJobId);
                    output = normalizeTailorResumeOutput(
                            enrichTailorResumeOutput(output, userId, userJobId, pendingResume),
                            userId,
                            userJobId);
                }

                SkillRun.SkillRunBuilder runBuilder = SkillRun.builder()
                        .userId(userId)
                        .userJobId(userJobId)
                        .skill(skill)
                        .input(mapper.createObjectNode())
                        .output(output)
                        .expiresAt(computeExpiry(skill));
                if (pendingResume != null) {
                    runBuilder.resumeHtml(pendingResume.html());
                    runBuilder.resumeFilename(pendingResume.storagePath());
                    if (output instanceof ObjectNode outNode
                            && pendingResume.html() != null
                            && !pendingResume.html().isBlank()
                            && outNode.path("resumeHtml").asText("").isBlank()) {
                        outNode.put("resumeHtml", pendingResume.html());
                        output = outNode;
                    }
                }
                SkillRun run = runBuilder.build();
                skillRuns.save(run);

                log.info("Skill {} completed and saved for userId={}", skill, userId);

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
                meterRegistry.counter("skill.run.failed", "skill", skill).increment();
                yield SkillRunResponse.error(skill, err.message());
            }
        };
    }

    /**
     * Fires after a Phase 1 skill successfully completes (AgentResult.Done).
     * Non-fatal — failures never affect the skill save or HTTP response.
     */
    private void triggerSkillCompleteEvents(String skill, UUID userId, UUID userJobId) {
        try {
            String displayName = SKILL_DISPLAY_NAMES.getOrDefault(
                    skill,
                    Character.toUpperCase(skill.charAt(0)) + skill.substring(1)
            );
            String jobTitle = fetchJobTitle(userJobId);

            emailService.sendSkillCompleteEmail(userId, displayName, jobTitle);

            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("skill", skill);
            meta.put("skillDisplayName", displayName);
            if (userJobId != null) meta.put("userJobId", userJobId.toString());

            notificationService.create(
                    userId,
                    Notification.TYPE_SKILL_COMPLETE,
                    "\u2728 " + displayName + " complete",
                    displayName + " finished for \"" + jobTitle + "\". View the results in your job detail page.",
                    meta
            );
        } catch (Exception e) {
            log.warn("triggerSkillCompleteEvents non-fatal failure for skill={}, userId={}: {}",
                     skill, userId, e.getMessage());
        }
    }

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

    private JsonNode parseOutput(String text) {
        return com.careerops.util.JsonExtractor.extract(text, mapper);
    }

    /**
     * Ensures the tailor skill always returns a panel-friendly shape (summary + sections)
     * even when the agent omits fields or only calls save_resume_html.
     */
    private SkillRunResponse runDedicatedTailorResume(UUID userId, UUID userJobId, SkillStartRequest req) {
        boolean forceRefresh = req != null && Boolean.TRUE.equals(req.forceRefresh());
        if (!forceRefresh && userJobId != null && CACHE_TTL_DAYS.containsKey("tailor-resume")) {
            Optional<SkillRun> cached = readTx.execute(status ->
                skillRuns.findValidCachedRun(userId, userJobId, "tailor-resume", Instant.now()));
            if (cached != null && cached.isPresent()) {
                log.debug("Cache hit for tailor-resume userId={}", userId);
                return SkillRunResponse.result("tailor-resume", cached.get().getOutput());
            }
        }

        String cvText = loadBaselineCv(userId);
        UserProfile profile = loadProfile(userId);
        Job job = loadJob(userJobId);
        if (job == null) {
            return SkillRunResponse.error("tailor-resume", "Job not found for tailoring.");
        }
        if (cvText.isBlank()) {
            return SkillRunResponse.error("tailor-resume", "Upload your CV in Settings before tailoring.");
        }

        try {
            ObjectNode built = tailorResumeBuilder.build(userId, profile, job, cvText, "dedicated");
            JsonNode output = normalizeTailorResumeOutput(built, userId, userJobId);
            output = enrichTailorResumeOutput(output, userId, userJobId, null);
            if (output instanceof ObjectNode outNode) {
                tailorResumeBuilder.attachRenderedPreview(outNode, profile, userId, job);
                output = outNode;
            }

            SkillRun run = SkillRun.builder()
                .userId(userId)
                .userJobId(userJobId)
                .skill("tailor-resume")
                .input(mapper.createObjectNode())
                .output(output)
                .resumeHtml(output.path("resumeHtml").asText(""))
                .expiresAt(computeExpiry("tailor-resume"))
                .build();
            skillRuns.save(run);
            triggerSkillCompleteEvents("tailor-resume", userId, userJobId);
            log.info("Dedicated tailor-resume completed for userId={}", userId);
            return SkillRunResponse.result("tailor-resume", output);
        } catch (Exception ex) {
            log.error("Dedicated tailor-resume failed for userId={}, userJobId={}: {}",
                    userId, userJobId, ex.getMessage(), ex);
            return SkillRunResponse.error("tailor-resume",
                    "Could not tailor your CV. Check that your CV is uploaded and try again.");
        }
    }

    private void clearStaleConversation(UUID userId, String skill, UUID userJobId) {
        writeTx.executeWithoutResult(status ->
            conversations.findByUserIdAndStatus(userId, "pending_answer").stream()
                .filter(c -> skill.equals(c.getSkill()))
                .filter(c -> userJobId == null || userJobId.equals(c.getUserJobId()))
                .forEach(conversations::delete));
    }

    private void invalidateSkillCache(UUID userId, UUID userJobId, String skill) {
        if (userJobId == null || skill == null) return;
        writeTx.executeWithoutResult(status ->
            skillRuns.deleteByUserIdAndUserJobIdAndSkill(userId, userJobId, skill));
    }

    private JsonNode normalizeTailorResumeOutput(JsonNode output, UUID userId, UUID userJobId) {
        com.fasterxml.jackson.databind.node.ObjectNode out = output != null && output.isObject()
                ? (com.fasterxml.jackson.databind.node.ObjectNode) output.deepCopy()
                : mapper.createObjectNode();
        if (output != null && output.isTextual()) {
            out.put("summary", output.asText());
        }
        String baseline = loadBaselineCv(userId);
        String summary = out.path("summary").asText("");
        if (summaryLooksLikeFullCv(summary, baseline)) {
            out.remove("summary");
            summary = "";
        }
        JsonNode sectionsNode = out.path("sections");
        boolean thinSections = !sectionsNode.isArray()
                || sectionsNode.isEmpty()
                || sectionsNode.size() < 2
                || !hasExperienceSection(sectionsNode);
        if (thinSections && userJobId != null && !TailorResumeQuality.isSubstantiallyTailored(out)) {
            mergeTailorFromBuilder(out, userId, userJobId, baseline);
        } else if (summary.isBlank() && !baseline.isBlank()) {
            out.put("summary", tailorResumeBuilder.build(
                    userId, loadProfile(userId), loadJob(userJobId), baseline, "normalize")
                .path("summary").asText(""));
        }
        if (!out.has("keywordsAdded") || !out.get("keywordsAdded").isArray()) {
            out.set("keywordsAdded", mapper.createArrayNode());
        }
        com.fasterxml.jackson.databind.node.ArrayNode warnings = out.has("warnings")
                && out.get("warnings").isArray()
                ? (com.fasterxml.jackson.databind.node.ArrayNode) out.get("warnings")
                : mapper.createArrayNode();
        appendProfessionalSummaryWarnings(out.path("summary").asText(""), warnings);
        out.set("warnings", warnings);
        UserProfile profile = loadProfile(userId);
        Job job = loadJob(userJobId);
        if (out instanceof com.fasterxml.jackson.databind.node.ObjectNode outNode) {
            tailorResumeBuilder.repairExperienceSectionsInPlace(outNode, profile, job, userId);
        }
        if (out.path("sections").isArray() && out.path("sections").size() > 0) {
            tailorResumeBuilder.attachRenderedPreview(out, profile, userId, job);
        } else if (out.path("resumeHtml").asText("").isBlank() && userJobId != null) {
            ObjectNode built = tailorResumeBuilder.build(
                    userId, profile, loadJob(userJobId), baseline, "normalize");
            out.put("resumeHtml", built.path("resumeHtml").asText(""));
            out.set("sections", built.path("sections"));
            out.put("tailoredMarkdown", built.path("tailoredMarkdown").asText(""));
        }
        return out;
    }

    private void mergeTailorFromBuilder(
            com.fasterxml.jackson.databind.node.ObjectNode out,
            UUID userId,
            UUID userJobId,
            String baseline) {
        ObjectNode built = tailorResumeBuilder.build(
                userId, loadProfile(userId), loadJob(userJobId), baseline, "merged");
        if (out.path("summary").asText("").isBlank()) {
            out.put("summary", built.path("summary").asText(""));
        }
        out.set("sections", built.path("sections"));
        if (out.path("keywordsAdded").isEmpty()) {
            out.set("keywordsAdded", built.path("keywordsAdded"));
        }
        tailorResumeBuilder.attachRenderedPreview(out, loadProfile(userId), userId, loadJob(userJobId));
        out.put("baselineMarkdown", built.path("baselineMarkdown").asText(""));
    }

    private static boolean hasExperienceSection(JsonNode sectionsNode) {
        for (JsonNode row : sectionsNode) {
            String name = row.path("name").asText("").toLowerCase(Locale.ROOT);
            if (name.contains("experience") && row.path("original").asText("").length() > 40) {
                return true;
            }
        }
        return false;
    }

    private static boolean summaryLooksLikeFullCv(String summary, String baseline) {
        if (summary == null || baseline == null || summary.isBlank() || baseline.isBlank()) {
            return false;
        }
        String s = summary.strip();
        String b = baseline.strip();
        if (s.length() > 600 && b.length() > 600) {
            return b.startsWith(s.substring(0, Math.min(200, s.length())))
                || s.startsWith(b.substring(0, Math.min(200, b.length())));
        }
        return s.length() > 400 && s.contains("##");
    }

    private String loadBaselineCv(UUID userId) {
        try {
            return cvService.activeCvText(userId);
        } catch (Exception e) {
            log.debug("Could not load baseline CV: {}", e.getMessage());
            return "";
        }
    }

    private UserProfile loadProfile(UUID userId) {
        return profiles.findByUserId(userId).orElse(null);
    }

    private Job loadJob(UUID userJobId) {
        if (userJobId == null) return null;
        return userJobs.findById(userJobId)
                .flatMap(uj -> jobs.findById(uj.getJobId()))
                .orElse(null);
    }

    /**
     * Flags summaries that do not look like the mandatory 3-sentence contract
     * (Who you are / Key skills / Value you bring).
     */
    private void appendProfessionalSummaryWarnings(
            String summary,
            com.fasterxml.jackson.databind.node.ArrayNode warnings) {
        if (summary == null || summary.isBlank()) {
            warnings.add("Professional Summary is missing. It must include: (1) Who you are, "
                    + "(2) Key skills/expertise, (3) Value you bring — one sentence each.");
            return;
        }
        String trimmed = summary.trim();
        long sentenceCount = java.util.Arrays.stream(trimmed.split("(?<=[.!?])\\s+"))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .count();
        if (sentenceCount < 3) {
            warnings.add("Professional Summary should be exactly 3 sentences: "
                    + "(1) Who you are, (2) Key skills/expertise relevant to this role, "
                    + "(3) Value you bring to this company/role.");
        }
    }

    private static String truncateForPanel(String text, int maxLen) {
        if (text == null || text.isBlank()) {
            return "(Upload your CV in Settings to see a before/after comparison.)";
        }
        String trimmed = text.trim();
        return trimmed.length() <= maxLen ? trimmed : trimmed.substring(0, maxLen) + "…";
    }

    private JsonNode enrichTailorResumeOutput(
            JsonNode raw,
            UUID userId,
            UUID userJobId,
            TailorResumePendingStore.Pending pendingResume) {
        com.fasterxml.jackson.databind.node.ObjectNode out = raw != null && raw.isObject()
                ? (com.fasterxml.jackson.databind.node.ObjectNode) raw.deepCopy()
                : mapper.createObjectNode();
        if (raw != null && raw.isTextual()) {
            out.put("text", raw.asText());
        }
        String cvText = pendingResume != null && pendingResume.html() != null
                ? htmlToPlainText(pendingResume.html())
                : out.path("text").asText("");
        if (cvText.isBlank()) {
            try {
                cvText = cvService.activeCvText(userId);
            } catch (Exception e) {
                log.debug("Could not load CV for tailor scoring: {}", e.getMessage());
            }
        }
        String tailoredForScore = tailorResumeBuilder.tailoredMarkdownFromOutput(out);
        if (!tailoredForScore.isBlank()) {
            cvText = tailoredForScore;
        }
        if (!cvText.isBlank()) {
            String jobText = fetchJobDescriptionText(userJobId);
            CvHumanScoreService.CvScoreResult scores =
                    cvHumanScoreService.score(cvText, jobText, userId);
            out.put("atsScore", scores.atsScore());
            out.put("humanScore", scores.humanScore());
            com.fasterxml.jackson.databind.node.ArrayNode flagged = mapper.createArrayNode();
            for (CvHumanScoreService.FlaggedPhrase fp : scores.flaggedPhrases()) {
                com.fasterxml.jackson.databind.node.ObjectNode row = mapper.createObjectNode();
                row.put("phrase", fp.phrase());
                row.put("context", fp.context());
                row.put("suggestedRewrite", fp.suggestedRewrite());
                flagged.add(row);
            }
            out.set("flaggedPhrases", flagged);
        }
        if (pendingResume != null) {
            out.put("resumeReady", true);
        }
        return out;
    }

    private String fetchJobDescriptionText(UUID userJobId) {
        if (userJobId == null) {
            return "";
        }
        return userJobs.findById(userJobId)
                .flatMap(uj -> jobs.findById(uj.getJobId()))
                .map(j -> {
                    StringBuilder sb = new StringBuilder();
                    if (j.getTitle() != null) {
                        sb.append(j.getTitle()).append("\n");
                    }
                    if (j.getDescription() != null) {
                        sb.append(j.getDescription());
                    }
                    return sb.toString();
                })
                .orElse("");
    }

    private static String htmlToPlainText(String html) {
        if (html == null || html.isBlank()) {
            return "";
        }
        return org.jsoup.Jsoup.parse(html).text();
    }

    private JsonNode normalizeEvaluateOutput(JsonNode raw, UUID userJobId) {
        var norm = evaluationValidator.normalizeOrPartial(raw, "skill_evaluate");
        JsonNode resolved = norm.report();
        if ((!norm.valid() || !isRichEvaluationReport(resolved)) && userJobId != null) {
            resolved = rebuildStructuredEvaluation(userJobId).orElse(resolved);
        }
        JsonNode report = overlayDeterministicSkillMatch(resolved, userJobId);
        if (userJobId != null) {
            userJobs.findById(userJobId).ifPresent(uj -> {
                uj.setMatchPercent(report.path("matchPercent").asInt(uj.getMatchPercent() != null ? uj.getMatchPercent() : 0));
                uj.setAiScore(report.path("overallScore").asInt(uj.getAiScore() != null ? uj.getAiScore() : 0));
                uj.setHumanSummary(report.path("humanSummary").asText(uj.getHumanSummary()));
                uj.setVerdict(report.path("verdict").asText(uj.getVerdict()));
                uj.setMatchedSkills(toStringArray(report.path("matchedSkills")));
                uj.setUnmatchedSkills(toStringArray(report.path("unmatchedSkills")));
                uj.setCvImprovementTips(toStringArray(report.path("cvImprovementTips")));
                uj.setScoreBreakdown(report);
                userJobs.save(uj);
            });
        }
        if (!norm.valid()) {
            log.warn("Evaluate skill partial for userJobId={}: {}", userJobId, norm.error());
        }
        return report;
    }

    /** Replace AI skill lists with deterministic CV ↔ JD matching (alias-aware). */
    private JsonNode overlayDeterministicSkillMatch(JsonNode report, UUID userJobId) {
        if (userJobId == null || report == null || !report.isObject()) {
            return report;
        }
        return userJobs.findById(userJobId)
            .flatMap(uj -> jobs.findById(uj.getJobId()).map(job -> {
                UserJobSkillMatchService.SkillMatch match =
                    skillMatchService.computeForUser(uj.getUserId(), job);
                ObjectNode out = report.deepCopy();
                skillMatchService.overlayOnReport(out, match);
                return (JsonNode) out;
            }))
            .orElse(report);
    }

    private Optional<JsonNode> rebuildStructuredEvaluation(UUID userJobId) {
        return userJobs.findById(userJobId).flatMap(uj ->
            profiles.findByUserId(uj.getUserId()).flatMap(profile ->
                jobs.findById(uj.getJobId()).map(job -> {
                    String cvText = cvService.activeCvText(uj.getUserId());
                    return evaluationEnrichment.ensureComplete(
                        uj.getUserId(), job, profile, cvText, uj.getScoreBreakdown(), "skill_evaluate");
                })));
    }

    private boolean isRichEvaluationReport(JsonNode report) {
        return evaluationEnrichment.isCompleteReport(report);
    }

    private static String[] toStringArray(JsonNode node) {
        if (node == null || !node.isArray()) return new String[0];
        List<String> out = new ArrayList<>();
        node.forEach(x -> {
            String s = x.asText(null);
            if (s != null && !s.isBlank()) out.add(s);
        });
        return out.toArray(new String[0]);
    }

    private @Nullable Instant computeExpiry(String skill) {
        Integer days = CACHE_TTL_DAYS.get(skill);
        return days != null ? Instant.now().plus(days, ChronoUnit.DAYS) : null;
    }

    private static boolean isBudgetDegradableSkill(String skill) {
        return "tailor-resume".equals(skill) || "evaluate".equals(skill);
    }

    private void notifyBudgetExhausted(UUID userId) {
        try {
            notificationService.create(
                userId,
                Notification.TYPE_SYSTEM,
                "Daily token budget exhausted",
                "You have exhausted your daily token usage limit. Tailor CV and evaluate will use local drafts until tomorrow.",
                Map.of("reason", "daily_token_budget")
            );
        } catch (Exception e) {
            log.warn("Failed to trigger budget notification: {}", e.getMessage());
        }
    }
}
