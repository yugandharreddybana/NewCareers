package com.careerops.controller;

import com.careerops.model.InterviewQuestionBank;
import com.careerops.model.InterviewSession;
import com.careerops.model.InterviewTrack;
import com.careerops.service.InterviewCoachService;
import com.careerops.service.MockInterviewService;
import com.careerops.util.AuthUtil;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Phase 3.1 — Interview Command Center
 *
 * POST /interviews/generate-kit/:userJobId      — generate AI interview kit
 * GET  /interviews/kit/:userJobId               — fetch kit questions for a job
 * POST /interviews/mock/start/:userJobId        — start a mock interview session
 * POST /interviews/mock/reply/:sessionId        — submit answer for scoring
 * GET  /interviews/history/:userJobId           — session history for a job
 * GET  /interviews/history                      — all sessions for current user
 * GET  /interviews/tracks                       — all tracks for current user
 * PATCH /interviews/tracks/:userJobId/stage     — update interview stage
 */
@RestController
@RequestMapping("/interviews")
public class InterviewController {

    private final InterviewCoachService coachService;
    private final MockInterviewService mockService;

    public InterviewController(InterviewCoachService coachService,
                                MockInterviewService mockService) {
        this.coachService = coachService;
        this.mockService = mockService;
    }

    @PostMapping("/generate-kit/{userJobId}")
    public ResponseEntity<List<InterviewQuestionBank>> generateKit(
            @PathVariable UUID userJobId,
            @RequestBody Map<String, String> body
    ) {
        UUID userId = AuthUtil.currentUserId();
        List<InterviewQuestionBank> kit = coachService.generateKit(
            userId, userJobId,
            body.get("companyName"),
            body.get("roleTitle"),
            body.get("jobDescription")
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(kit);
    }

    @GetMapping("/kit/{userJobId}")
    public ResponseEntity<List<InterviewQuestionBank>> getKit(@PathVariable UUID userJobId) {
        return ResponseEntity.ok(coachService.getKitForJob(userJobId));
    }

    @PostMapping("/mock/start/{userJobId}")
    public ResponseEntity<Map<String, Object>> startMock(
            @PathVariable UUID userJobId,
            @RequestBody(required = false) Map<String, String> body
    ) {
        UUID userId = AuthUtil.currentUserId();
        UUID trackId = body != null && body.get("trackId") != null
            ? UUID.fromString(body.get("trackId")) : null;
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(mockService.start(userId, userJobId, trackId));
    }

    @PostMapping("/mock/reply/{sessionId}")
    public ResponseEntity<Map<String, Object>> replyMock(
            @PathVariable UUID sessionId,
            @RequestBody Map<String, String> body
    ) {
        UUID userId = AuthUtil.currentUserId();
        UUID questionId = UUID.fromString(body.get("questionId"));
        String answer = body.get("answer");
        return ResponseEntity.ok(mockService.reply(userId, sessionId, questionId, answer));
    }

    @GetMapping("/history/{userJobId}")
    public ResponseEntity<List<InterviewSession>> historyForJob(@PathVariable UUID userJobId) {
        return ResponseEntity.ok(mockService.historyForJob(userJobId));
    }

    @GetMapping("/history")
    public ResponseEntity<List<InterviewSession>> historyForUser() {
        return ResponseEntity.ok(mockService.historyForUser(AuthUtil.currentUserId()));
    }

    @GetMapping("/tracks")
    public ResponseEntity<List<InterviewTrack>> listTracks() {
        return ResponseEntity.ok(coachService.listTracks(AuthUtil.currentUserId()));
    }

    @PatchMapping("/tracks/{userJobId}/stage")
    public ResponseEntity<InterviewTrack> updateStage(
            @PathVariable UUID userJobId,
            @RequestBody Map<String, String> body
    ) {
        return ResponseEntity.ok(
            coachService.updateStage(AuthUtil.currentUserId(), userJobId, body.get("stage"))
        );
    }
}
