package com.careerops.controller;

import com.careerops.model.InterviewQuestionBank;
import com.careerops.model.InterviewSession;
import com.careerops.model.InterviewTrack;
import com.careerops.service.InterviewCoachService;
import com.careerops.service.MockInterviewService;
import com.careerops.util.AuthUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/interview")
@RequiredArgsConstructor
public class InterviewController {

    private final InterviewCoachService interviewCoachService;
    private final MockInterviewService mockInterviewService;

    // ─── Task 9: Get or create an interview track for a job ──────────────────
    @PostMapping("/track")
    public ResponseEntity<InterviewTrack> getOrCreateTrack(@RequestParam UUID userJobId) {
        UUID userId = AuthUtil.currentUserId();
        InterviewTrack track = interviewCoachService.getOrCreateTrack(userJobId, userId);
        return ResponseEntity.ok(track);
    }

    // ─── Task 10: Get all interview tracks for the logged-in user ────────────
    @GetMapping("/tracks")
    public ResponseEntity<List<InterviewTrack>> getMyTracks() {
        UUID userId = AuthUtil.currentUserId();
        return ResponseEntity.ok(interviewCoachService.getTracksByUser(userId));
    }

    // ─── Task 10: Update interview stage (e.g. APPLIED → PHONE_SCREEN) ───────
    @PatchMapping("/track/{trackId}/stage")
    public ResponseEntity<InterviewTrack> updateStage(
            @PathVariable UUID trackId,
            @RequestParam String stage) {
        return ResponseEntity.ok(interviewCoachService.updateStage(trackId, stage));
    }

    // ─── Task 11: Generate AI interview kit (10 questions) for a job ─────────
    @PostMapping("/kit")
    public ResponseEntity<List<InterviewQuestionBank>> generateKit(@RequestParam UUID userJobId) {
        UUID userId = AuthUtil.currentUserId();
        List<InterviewQuestionBank> kit = interviewCoachService.generateInterviewKit(userJobId, userId);
        return ResponseEntity.ok(kit);
    }

    // ─── Task 11: Get existing kit questions for a track ─────────────────────
    @GetMapping("/kit/{trackId}")
    public ResponseEntity<List<InterviewQuestionBank>> getKit(@PathVariable UUID trackId) {
        return ResponseEntity.ok(interviewCoachService.getKitByTrack(trackId));
    }

    // ─── Task 12: Start a mock interview session ──────────────────────────────
    @PostMapping("/session/start")
    public ResponseEntity<InterviewSession> startSession(@RequestParam UUID userJobId) {
        UUID userId = AuthUtil.currentUserId();
        InterviewSession session = mockInterviewService.startSession(userJobId, userId);
        return ResponseEntity.ok(session);
    }

    // ─── Task 12: Submit an answer, get AI score + feedback back ─────────────
    @PostMapping("/session/{sessionId}/answer")
    public ResponseEntity<Map<String, Object>> submitAnswer(
            @PathVariable UUID sessionId,
            @RequestParam UUID questionId,
            @RequestBody Map<String, String> body) {
        String userAnswer = body.get("answer");
        Map<String, Object> result = mockInterviewService.processReply(sessionId, questionId, userAnswer);
        return ResponseEntity.ok(result);
    }

    // ─── Task 12: Complete a session, get overall score + summary ────────────
    @PostMapping("/session/{sessionId}/complete")
    public ResponseEntity<InterviewSession> completeSession(@PathVariable UUID sessionId) {
        return ResponseEntity.ok(mockInterviewService.completeSession(sessionId));
    }

    // ─── Task 12: Get session history for a job ───────────────────────────────
    @GetMapping("/session/history")
    public ResponseEntity<List<InterviewSession>> getSessionHistory(@RequestParam UUID userJobId) {
        return ResponseEntity.ok(mockInterviewService.getSessionHistory(userJobId));
    }
}
