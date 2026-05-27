package com.careerops.controller;

import com.careerops.dto.ConversationReplyRequest;
import com.careerops.dto.JobEvaluationPdfRequest;
import com.careerops.dto.BatchRunStatusResponse;
import com.careerops.dto.RunAllSkillsResponse;
import com.careerops.dto.SkillRunResponse;
import com.careerops.dto.SkillStartRequest;
import com.careerops.ratelimit.RateLimited;
import com.careerops.service.PdfExportService;
import com.careerops.service.SkillService;
import com.careerops.util.AuthUtil;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Unified skills controller.
 *
 * CORS Policy:
 * - Allowed Origins: from ${cors.allowed.origins}
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Internal-Secret, X-Internal-User-Id
 * - Exposed: X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 */
@RestController
@RequestMapping("/skills")
@io.micrometer.core.annotation.Timed
public class SkillsController {

    private static final Logger log = LoggerFactory.getLogger(SkillsController.class);

    private final SkillService    skillService;
    private final PdfExportService pdfService;

    public SkillsController(
            SkillService skillService,
            PdfExportService pdfService) {
        this.skillService = skillService;
        this.pdfService   = pdfService;
    }

    // ================================================================
    // START A SKILL
    // ================================================================

    /**
     * Start any of the 9 career-ops skills.
     *
     * POST /api/skills/start
     * Body: { skillName, userJobId, channel?, tone?, step?, compareJobIds?, scanTarget? }
     *
     * Response type determines frontend behaviour:
     *   RESULT            → render skill output
     *   QUESTION          → show question modal
     *   PROFILE_INCOMPLETE → show missing fields alert
     *   ERROR             → show error in skill panel
     */
    @PostMapping("/start")
    @RateLimited(capacity = 5, requestsPerMinute = 5)
    public SkillRunResponse startSkill(
            @Valid @RequestBody SkillStartRequest req) {

        UUID userId = AuthUtil.currentUserId();
        log.info("POST /api/skills/start skill={} userId={}", req.skillName(), userId);

        return skillService.startSkill(req, userId);
    }

    // ================================================================
    // REPLY TO A PAUSED CONVERSATION
    // ================================================================

    /**
     * Submit the user's answer to Claude's question.
     *
     * POST /api/skills/conversation/reply
     * Body: { conversationId, answer }
     *
     * Returns a new SkillRunResponse — may be another QUESTION if Claude asks again.
     */
    @PostMapping("/conversation/reply")
    @RateLimited(capacity = 5, requestsPerMinute = 5)
    public SkillRunResponse replyToConversation(
            @Valid @RequestBody ConversationReplyRequest req) {

        UUID userId = AuthUtil.currentUserId();
        log.info("POST /api/skills/conversation/reply convId={} userId={}",
                req.conversationId(), userId);

        return skillService.resumeConversation(
                req.conversationId(), req.answer(), userId);
    }

    // ================================================================
    // RUN ALL SKILLS
    // ================================================================

    /**
     * Run all 9 skills for a given job.
     * POST /api/skills/run-all/{userJobId}
     */
    @PostMapping("/run-all/{userJobId}")
    @RateLimited(capacity = 2, requestsPerMinute = 2)
    public RunAllSkillsResponse runAll(
            @PathVariable UUID userJobId) {

        UUID userId = AuthUtil.currentUserId();
        log.info("POST /api/skills/run-all userJobId={} userId={}", userJobId, userId);

        return skillService.runAllSkills(userId, userJobId);
    }

    /**
     * Start an asynchronous run-all batch and return immediately with a batch id.
     * POST /api/skills/run-all-async/{userJobId}
     */
    @PostMapping("/run-all-async/{userJobId}")
    @RateLimited(capacity = 2, requestsPerMinute = 2)
    public BatchRunStatusResponse runAllAsync(
            @PathVariable UUID userJobId) {

        UUID userId = AuthUtil.currentUserId();
        log.info("POST /api/skills/run-all-async userJobId={} userId={}", userJobId, userId);

        return skillService.runAllSkillsAsync(userId, userJobId);
    }

    /**
     * Poll the status of an asynchronous run-all batch.
     * GET /api/skills/run-all/{batchId}/status
     */
    @GetMapping("/run-all/{batchId}/status")
    @RateLimited(capacity = 30, requestsPerMinute = 30)
    public BatchRunStatusResponse getRunAllStatus(
            @PathVariable UUID batchId) {

        UUID userId = AuthUtil.currentUserId();
        return skillService.getBatchStatus(userId, batchId);
    }

    // ================================================================
    // GET LAST RUN (cached result, no re-execution)
    // ================================================================

    /**
     * Get the most recent skill run result without triggering a new run.
     * GET /api/skills/last-run/{userJobId}/{skillName}
     */
    @GetMapping("/last-run/{userJobId}/{skillName}")
    public ResponseEntity<SkillRunResponse> getLastRun(
            @PathVariable UUID userJobId,
            @PathVariable String skillName) {

        UUID userId = AuthUtil.currentUserId();
        return skillService.findLastRun(userId, userJobId, skillName)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    // ================================================================
    // PDF DOWNLOADS
    // ================================================================

    /**
     * Download a single skill as PDF.
     * GET /api/skills/pdf/{userJobId}/{skillName}
     */
    /**
     * Render a job evaluation PDF from the modal payload (works for preview and live jobs).
     * POST /api/skills/pdf/evaluation-report
     */
    @PostMapping(value = "/pdf/evaluation-report", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> downloadEvaluationReportPdf(
            @Valid @RequestBody JobEvaluationPdfRequest request) {
        byte[] pdf = pdfService.generateEvaluationReportPdf(request);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"job-evaluation-report.pdf\"")
            .contentType(MediaType.APPLICATION_PDF)
            .header("X-Content-Type-Options", "nosniff")
            .body(pdf);
    }

    @GetMapping("/pdf/{userJobId}/{skillName}")
    public byte[] downloadSkillPdf(
            @PathVariable UUID userJobId,
            @PathVariable String skillName,
            jakarta.servlet.http.HttpServletResponse response) {

        UUID userId = AuthUtil.currentUserId();
        byte[] pdf = pdfService.generateSkillPdf(userId, userJobId, skillName);
        pdfResponse(pdf, skillName + "-report.pdf", response);
        return pdf;
    }

    /**
     * Download all 9 skills as a single PDF.
     * GET /api/skills/pdf/{userJobId}/all
     */
    @GetMapping("/pdf/{userJobId}/all")
    public byte[] downloadAllSkillsPdf(
            @PathVariable UUID userJobId,
            jakarta.servlet.http.HttpServletResponse response) {

        UUID userId = AuthUtil.currentUserId();
        byte[] pdf = pdfService.generateAllSkillsPdf(userId, userJobId);
        pdfResponse(pdf, "careerops-complete-pack.pdf", response);
        return pdf;
    }

    /**
     * Download tailored resume as PDF.
     * GET /api/skills/pdf/{userJobId}/resume
     */
    @GetMapping("/pdf/{userJobId}/resume")
    public byte[] downloadResumePdf(
            @PathVariable UUID userJobId,
            jakarta.servlet.http.HttpServletResponse response) {

        UUID userId = AuthUtil.currentUserId();
        byte[] pdf = pdfService.generateResumePdf(userId, userJobId);
        pdfResponse(pdf, "tailored-resume.pdf", response);
        return pdf;
    }

    // ================================================================
    // UTILITIES
    // ================================================================

    private void pdfResponse(byte[] pdf, String filename, jakarta.servlet.http.HttpServletResponse response) {
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"");
        response.setContentType(MediaType.APPLICATION_PDF_VALUE);
        response.setHeader("X-Content-Type-Options", "nosniff");
    }
}
