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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Orchestrates all 14 CareerOps skills (9 Phase 1 + 5 Phase 2).
 *
 * Routing:
 *   Phase 1 skills  → NvidiaAgentService (multi-turn agentic tool loop, OpenAI format)
 *   Phase 2 skills  → SkillHandlerRegistry (NvidiaService direct single-turn, structured JSON)
 *
 * Flow (Phase 1):
 *   1. Validate profile completeness (ProfileValidator)
 *   2. Check TTL cache (SkillRunRepository)
 *   3. Build system prompt (SkillPromptLibrary)
 *   4. Run NVIDIA agentic loop (NvidiaAgentService)
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
    private final TransactionTemplate           readTx;
    private final TransactionTemplate           writeTx;

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
            return registry.execute(skill, userId, userJobId);
        }

        // Step 3: Phase 1 — TTL cache check
        if (userJobId != null && CACHE_TTL_DAYS.containsKey(skill)) {
            Optional<SkillRun> cached = readTx.execute(status ->
                    skillRuns.findValidCachedRun(userId, userJobId, skill, Instant.now()));
            if (cached != null && cached.isPresent()) {
                log.debug("Cache hit for Phase 1 skill={}, userId={}", skill, userId);
                return SkillRunResponse.result(skill, cached.get().getOutput());
            }
        }

        // Step 4: Phase 1 — NVIDIA agentic loop (no DB connection held during AI call)
        String systemPrompt = prompts.buildFullSystemPrompt(skill, userId);
        ArrayNode messages  = buildInitialMessages(req, userId);
        AgentResult result  = nvidia.run(systemPrompt, messages, userId, userJobId);

        return writeTx.execute(status ->
                handleAgentResult(result, skill, userId, userJobId, messages));
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

        ArrayNode history = (ArrayNode) conv.getMessages();

        ObjectNode toolResultMsg = mapper.createObjectNode();
        toolResultMsg.put("role", "tool");
        toolResultMsg.put("tool_call_id", conv.getToolUseId());
        toolResultMsg.put("content", answer == null || answer.isBlank()
                ? "[User skipped this question]" : answer);
        history.add(toolResultMsg);

        String skill = conv.getSkill();
        UUID userJobId = conv.getUserJobId();
        String systemPrompt = prompts.buildFullSystemPrompt(skill, userId);
        AgentResult result  = nvidia.run(systemPrompt, history, userId, userJobId);

        writeTx.executeWithoutResult(status -> {
            conv.setStatus("completed");
            conversations.save(conv);
        });

        return writeTx.execute(status -> handleAgentResult(result, skill, userId, userJobId, history));
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
                        new SkillStartRequest(skill, userJobId, null, null, null, null, null), userId);
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
                    startSkill(new SkillStartRequest(s, userJobId, null, null, null, null, null), userId);
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
                            userId);
                }

                skillRuns.deleteByUserIdAndUserJobIdAndSkill(userId, userJobId, skill);

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
    private JsonNode normalizeTailorResumeOutput(JsonNode output, UUID userId) {
        com.fasterxml.jackson.databind.node.ObjectNode out = output != null && output.isObject()
                ? (com.fasterxml.jackson.databind.node.ObjectNode) output.deepCopy()
                : mapper.createObjectNode();
        if (output != null && output.isTextual()) {
            out.put("summary", output.asText());
        }
        JsonNode sectionsNode = out.path("sections");
        if (!sectionsNode.isArray() || sectionsNode.isEmpty()) {
            String baseline = "";
            try {
                baseline = cvService.activeCvText(userId);
            } catch (Exception e) {
                log.debug("Could not load baseline CV for tailor sections: {}", e.getMessage());
            }
            String summary = out.path("summary").asText("");
            if (summary.isBlank() && !baseline.isBlank()) {
                summary = baseline.lines()
                        .map(String::trim)
                        .filter(line -> !line.isBlank())
                        .limit(3)
                        .reduce((a, b) -> a + " " + b)
                        .orElse("Tailored CV for this role.");
                out.put("summary", summary);
            }
            com.fasterxml.jackson.databind.node.ArrayNode sections = mapper.createArrayNode();
            com.fasterxml.jackson.databind.node.ObjectNode row = mapper.createObjectNode();
            row.put("name", "Professional summary");
            row.put("original", truncateForPanel(baseline, 1200));
            row.put("rewritten", summary.isBlank()
                    ? "Tailored content is being prepared — re-run if this stays empty."
                    : summary);
            row.put("rationale", "Baseline CV versus role-targeted opening aligned to the job description.");
            sections.add(row);
            out.set("sections", sections);
        }
        if (!out.has("keywordsAdded") || !out.get("keywordsAdded").isArray()) {
            out.set("keywordsAdded", mapper.createArrayNode());
        }
        if (!out.has("warnings") || !out.get("warnings").isArray()) {
            out.set("warnings", mapper.createArrayNode());
        }
        return out;
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
        JsonNode report = norm.report();
        if (userJobId != null) {
            userJobs.findById(userJobId).ifPresent(uj -> {
                uj.setMatchPercent(report.path("matchPercent").asInt(uj.getMatchPercent() != null ? uj.getMatchPercent() : 0));
                uj.setAiScore(report.path("overallScore").asInt(uj.getAiScore() != null ? uj.getAiScore() : 0));
                uj.setHumanSummary(report.path("humanSummary").asText(uj.getHumanSummary()));
                uj.setVerdict(report.path("verdict").asText(uj.getVerdict()));
                uj.setScoreBreakdown(report);
                userJobs.save(uj);
            });
        }
        if (!norm.valid()) {
            log.warn("Evaluate skill partial for userJobId={}: {}", userJobId, norm.error());
        }
        return report;
    }

    private @Nullable Instant computeExpiry(String skill) {
        Integer days = CACHE_TTL_DAYS.get(skill);
        return days != null ? Instant.now().plus(days, ChronoUnit.DAYS) : null;
    }
}
