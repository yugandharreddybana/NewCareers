package com.careerops.controller;

import com.careerops.model.InterviewQuestionBank;
import com.careerops.model.InterviewSession;
import com.careerops.model.InterviewTrack;
import com.careerops.service.InterviewCoachService;
import com.careerops.service.MockInterviewService;
import com.careerops.service.PdfExportService;
import com.careerops.util.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Tasks 9-12 — Interview endpoints.
 * POST /api/interviews/generate-kit/:userJobId
 * POST /api/interviews/mock/start/:userJobId
 * POST /api/interviews/mock/reply/:sessionId
 * GET  /api/interviews/history/:userJobId
 * GET  /api/interviews/kit/export/:userJobId   (Task 17 — PDF export)
 */
@RestController
@RequestMapping("/api/interviews")
@RequiredArgsConstructor
public class InterviewController {

    private final InterviewCoachService coachService;
    private final MockInterviewService mockService;
    private final PdfExportService pdfExportService;
    private final JwtUtil jwtUtil;

    /** Task 9 — Generate interview kit */
    @PostMapping("/generate-kit/{userJobId}")
    public ResponseEntity<InterviewTrack> generateKit(
            @PathVariable UUID userJobId,
            HttpServletRequest req) {
        UUID userId = extractUserId(req);
        InterviewTrack track = coachService.generateKit(userJobId, userId);
        return ResponseEntity.ok(track);
    }

    /** Task 10 — Start mock interview session */
    @PostMapping("/mock/start/{userJobId}")
    public ResponseEntity<InterviewSession> startMock(
            @PathVariable UUID userJobId,
            HttpServletRequest req) {
        UUID userId = extractUserId(req);
        InterviewSession session = mockService.startSession(userJobId, userId);
        return ResponseEntity.ok(session);
    }

    /** Task 11 — Submit reply in mock session */
    @PostMapping("/mock/reply/{sessionId}")
    public ResponseEntity<InterviewSession> reply(
            @PathVariable UUID sessionId,
            @RequestBody Map<String, String> body,
            HttpServletRequest req) {
        UUID userId = extractUserId(req);
        String answer = body.getOrDefault("answer", "");
        InterviewSession updated = mockService.processReply(sessionId, userId, answer);
        return ResponseEntity.ok(updated);
    }

    /** Task 12 — Get interview history for a job */
    @GetMapping("/history/{userJobId}")
    public ResponseEntity<List<InterviewSession>> history(
            @PathVariable UUID userJobId,
            HttpServletRequest req) {
        UUID userId = extractUserId(req);
        List<InterviewSession> sessions = mockService.getHistory(userJobId, userId);
        return ResponseEntity.ok(sessions);
    }

    /** Task 12b — Get question bank for a job */
    @GetMapping("/kit/{userJobId}")
    public ResponseEntity<List<InterviewQuestionBank>> getKit(
            @PathVariable UUID userJobId,
            HttpServletRequest req) {
        UUID userId = extractUserId(req);
        List<InterviewQuestionBank> questions = coachService.getQuestionsForJob(userJobId);
        return ResponseEntity.ok(questions);
    }

    /** Task 17 — Export interview kit as PDF */
    @GetMapping("/kit/export/{userJobId}")
    public ResponseEntity<byte[]> exportKitPdf(
            @PathVariable UUID userJobId,
            HttpServletRequest req) {
        UUID userId = extractUserId(req);
        List<InterviewQuestionBank> questions = coachService.getQuestionsForJob(userJobId);
        byte[] pdf = pdfExportService.generateInterviewKitPdf(questions, userJobId.toString());
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=interview-kit.pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    /** Task 17 — Export completed mock interview report as PDF */
    @GetMapping("/mock/export/{sessionId}")
    public ResponseEntity<byte[]> exportSessionPdf(
            @PathVariable UUID sessionId,
            HttpServletRequest req) {
        // fetch session and generate PDF report
        byte[] pdf = pdfExportService.generateMockInterviewReportPdf(sessionId.toString());
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=mock-interview-report.pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    private UUID extractUserId(HttpServletRequest req) {
        String header = req.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            throw new SecurityException("Missing or invalid Authorization header");
        }
        return UUID.fromString(jwtUtil.extractUserId(header.substring(7)));
    }
}
