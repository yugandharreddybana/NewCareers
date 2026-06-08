package com.careerops.controller;

import com.careerops.annotation.PlanGated;
import com.careerops.service.InterviewCoachService;
import com.careerops.service.MockInterviewService;
import com.careerops.util.AuthUtil;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Phase 3.1 — Interview Command Center
 *
 * CORS Policy:
 * - Allowed Origins: from ${cors.allowed.origins}
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Internal-Secret, X-Internal-User-Id
 * - Exposed: X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 */
@RestController
@RequestMapping("/interviews")
@io.micrometer.core.annotation.Timed
public class InterviewController {

    private final InterviewCoachService coachService;
    private final MockInterviewService mockService;

    public InterviewController(InterviewCoachService coachService,
                                MockInterviewService mockService) {
        this.coachService = coachService;
        this.mockService = mockService;
    }

    public record GenerateKitRequest(
        @jakarta.validation.constraints.NotBlank(message = "companyName is required") String companyName,
        @jakarta.validation.constraints.NotBlank(message = "roleTitle is required") String roleTitle,
        String jobDescription
    ) {}

    public record StartMockRequest(String trackId) {}

    public record ReplyRequest(
        @jakarta.validation.constraints.NotBlank(message = "questionId is required") String questionId,
        @jakarta.validation.constraints.NotBlank(message = "answer is required") String answer
    ) {}

    public record UpdateStageRequest(
        @jakarta.validation.constraints.NotBlank(message = "stage is required") String stage
    ) {}

    @PostMapping("/generate-kit/{userJobId}")
    @ResponseStatus(HttpStatus.CREATED)
    @PlanGated("ai_skill_run")
    public List<com.careerops.dto.InterviewDTO.QuestionResponse> generateKit(
            @PathVariable UUID userJobId,
            @jakarta.validation.Valid @RequestBody GenerateKitRequest req
    ) {
        UUID userId = AuthUtil.currentUserId();
        List<com.careerops.model.InterviewQuestionBank> kit = coachService.generateKit(
            userId, userJobId,
            req.companyName(),
            req.roleTitle(),
            req.jobDescription()
        );
        return kit.stream().map(coachService::toQuestionResponse).toList();
    }

    @GetMapping("/kit/{userJobId}")
    public List<com.careerops.dto.InterviewDTO.QuestionResponse> getKit(@PathVariable UUID userJobId) {
        UUID userId = AuthUtil.currentUserId();
        return coachService.getKitForJob(userJobId, userId).stream()
                .map(coachService::toQuestionResponse).toList();
    }

    @PostMapping("/mock/start/{userJobId}")
    @ResponseStatus(HttpStatus.CREATED)
    @PlanGated("ai_skill_run")
    public Map<String, Object> startMock(
            @PathVariable UUID userJobId,
            @jakarta.validation.Valid @jakarta.validation.constraints.NotNull @RequestBody StartMockRequest req
    ) {
        UUID userId = AuthUtil.currentUserId();
        UUID trackId = (req != null && req.trackId() != null)
            ? UUID.fromString(req.trackId()) : null;
        return mockService.start(userId, userJobId, trackId);
    }

    @PostMapping("/mock/reply/{sessionId}")
    @PlanGated("ai_skill_run")
    public Map<String, Object> replyMock(
            @PathVariable UUID sessionId,
            @jakarta.validation.Valid @RequestBody ReplyRequest req
    ) {
        UUID userId = AuthUtil.currentUserId();
        UUID questionId = UUID.fromString(req.questionId());
        String answer = req.answer();
        return mockService.reply(userId, sessionId, questionId, answer);
    }

    @GetMapping("/history/{userJobId}")
    public List<com.careerops.dto.InterviewDTO.SessionResponse> historyForJob(@PathVariable UUID userJobId) {
        UUID userId = AuthUtil.currentUserId();
        return mockService.historyForJob(userJobId, userId).stream()
                .map(mockService::toSessionResponse).toList();
    }

    @GetMapping("/history")
    public List<com.careerops.dto.InterviewDTO.SessionResponse> historyForUser() {
        return mockService.historyForUser(AuthUtil.currentUserId()).stream()
                .map(mockService::toSessionResponse).toList();
    }

    @GetMapping("/tracks")
    public List<com.careerops.dto.InterviewDTO.TrackResponse> listTracks() {
        return coachService.listTracks(AuthUtil.currentUserId()).stream()
                .map(coachService::toTrackResponse).toList();
    }

    @GetMapping("/tracks/{userJobId}")
    public com.careerops.dto.InterviewDTO.TrackResponse getTrack(@PathVariable UUID userJobId) {
        return coachService.toTrackResponse(
            coachService.getTrack(AuthUtil.currentUserId(), userJobId));
    }

    @PatchMapping("/tracks/{userJobId}/stage")
    public com.careerops.dto.InterviewDTO.TrackResponse updateStage(
            @PathVariable UUID userJobId,
            @jakarta.validation.Valid @RequestBody UpdateStageRequest req
    ) {
        return coachService.toTrackResponse(coachService.updateStage(AuthUtil.currentUserId(), userJobId, req.stage()));
    }
}
