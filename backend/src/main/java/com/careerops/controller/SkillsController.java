package com.careerops.controller;

import com.careerops.dto.ConversationReplyRequest;
import com.careerops.dto.RunAllSkillsResponse;
import com.careerops.dto.SkillRunResponse;
import com.careerops.dto.SkillStartRequest;
import com.careerops.security.JwtService;
import com.careerops.service.PdfExportService;
import com.careerops.service.SkillService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Unified skills controller.
 *
 * All 9 skills share a single /api/skills/start endpoint.
 * Replaces the old per-skill endpoints (/evaluate, /tailor-resume, etc.)
 *
 * Security: userId is ALWAYS extracted from the JWT token.
 * It is never accepted from the request body or path variables.
 */
@RestController
@RequestMapping("/api/skills")
public class SkillsController {

    private static final Logger log = LoggerFactory.getLogger(SkillsController.class);

    private final SkillService    skillService;
    private final PdfExportService pdfService;
    private final JwtService       jwtService;

    public SkillsController(
            SkillService skillService,
            PdfExportService pdfService,
            JwtService jwtService) {
        this.skillService = skillService;
        this.pdfService   = pdfService;
        this.jwtService   = jwtService;
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
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<SkillRunResponse> startSkill(
            @Valid @RequestBody SkillStartRequest req,
            @RequestHeader("Authorization") String authHeader) {

        UUID userId = extractUserId(authHeader);
        log.info("POST /api/skills/start skill={} userId={}", req.skillName(), userId);

        SkillRunResponse response = skillService.startSkill(req, userId);
        return ResponseEntity.ok(response);
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
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<SkillRunResponse> replyToConversation(
            @Valid @RequestBody ConversationReplyRequest req,
            @RequestHeader("Authorization") String authHeader) {

        UUID userId = extractUserId(authHeader);
        log.info("POST /api/skills/conversation/reply convId={} userId={}",
                req.conversationId(), userId);

        SkillRunResponse response = skillService.resumeConversation(
                req.conversationId(), req.answer(), userId);
        return ResponseEntity.ok(response);
    }

    // ================================================================
    // RUN ALL SKILLS
    // ================================================================

    /**
     * Run all 9 skills for a given job.
     * POST /api/skills/run-all/{userJobId}
     */
    @PostMapping("/run-all/{userJobId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<RunAllSkillsResponse> runAll(
            @PathVariable UUID userJobId,
            @RequestHeader("Authorization") String authHeader) {

        UUID userId = extractUserId(authHeader);
        log.info("POST /api/skills/run-all userJobId={} userId={}", userJobId, userId);

        RunAllSkillsResponse response = skillService.runAllSkills(userId, userJobId);
        return ResponseEntity.ok(response);
    }

    // ================================================================
    // GET LAST RUN (cached result, no re-execution)
    // ================================================================

    /**
     * Get the most recent skill run result without triggering a new run.
     * GET /api/skills/last-run/{userJobId}/{skillName}
     */
    @GetMapping("/last-run/{userJobId}/{skillName}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<SkillRunResponse> getLastRun(
            @PathVariable UUID userJobId,
            @PathVariable String skillName,
            @RequestHeader("Authorization") String authHeader) {

        UUID userId = extractUserId(authHeader);
        return ResponseEntity.ok(skillService.getLastRun(userId, userJobId, skillName));
    }

    // ================================================================
    // PDF DOWNLOADS
    // ================================================================

    /**
     * Download a single skill as PDF.
     * GET /api/skills/pdf/{userJobId}/{skillName}
     */
    @GetMapping("/pdf/{userJobId}/{skillName}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<byte[]> downloadSkillPdf(
            @PathVariable UUID userJobId,
            @PathVariable String skillName,
            @RequestHeader("Authorization") String authHeader) {

        UUID userId = extractUserId(authHeader);
        try {
            byte[] pdf = pdfService.generateSkillPdf(userId, userJobId, skillName);
            return pdfResponse(pdf, skillName + "-report.pdf");
        } catch (Exception e) {
            log.error("PDF generation failed for skill={}: {}", skillName, e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Download all 9 skills as a single PDF.
     * GET /api/skills/pdf/{userJobId}/all
     */
    @GetMapping("/pdf/{userJobId}/all")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<byte[]> downloadAllSkillsPdf(
            @PathVariable UUID userJobId,
            @RequestHeader("Authorization") String authHeader) {

        UUID userId = extractUserId(authHeader);
        try {
            byte[] pdf = pdfService.generateAllSkillsPdf(userId, userJobId);
            return pdfResponse(pdf, "careerops-complete-pack.pdf");
        } catch (Exception e) {
            log.error("All-skills PDF failed: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Download tailored resume as PDF.
     * GET /api/skills/pdf/{userJobId}/resume
     */
    @GetMapping("/pdf/{userJobId}/resume")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<byte[]> downloadResumePdf(
            @PathVariable UUID userJobId,
            @RequestHeader("Authorization") String authHeader) {

        UUID userId = extractUserId(authHeader);
        try {
            byte[] pdf = pdfService.generateResumePdf(userId, userJobId);
            return pdfResponse(pdf, "tailored-resume.pdf");
        } catch (Exception e) {
            log.error("Resume PDF failed: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    // ================================================================
    // UTILITIES
    // ================================================================

    private ResponseEntity<byte[]> pdfResponse(byte[] pdf, String filename) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\"")
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_PDF_VALUE)
                .header("X-Content-Type-Options", "nosniff")
                .body(pdf);
    }

    /**
     * Extract authenticated user ID from JWT bearer token.
     * Never accepts userId from request body or path — always from token.
     */
    private UUID extractUserId(String authHeader) {
        String token = authHeader.replace("Bearer ", "").trim();
        String subject = jwtService.parseUserId(token);
        return UUID.fromString(subject);
    }
}
