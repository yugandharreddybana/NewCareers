package com.careerops.controller;

import com.careerops.dto.MockInterviewDtos.InterviewKitRequest;
import com.careerops.dto.MockInterviewDtos.InterviewKitResponse;
import com.careerops.service.MockInterviewService;
import com.careerops.util.AuthUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.UUID;

/**
 * Mock Interview Controller
 *
 * B2-G4 FIX: generateInterviewKitAsync() existed in MockInterviewService
 * but had no controller endpoint, making it completely unreachable.
 *
 * Endpoints:
 *   POST /interview-kit           → synchronous (backward compat)
 *   POST /interview-kit/async     → 202 Accepted + X-Kit-Job-Id header (B2-G4)
 *   GET  /interview-kit/result/{jobId} → poll result
 */
@RestController
@RequestMapping("/api/v1/mock-interview")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Mock Interview", description = "AI-generated mock interview kit")
public class MockInterviewController {

    private final MockInterviewService mockInterviewService;

    // ── Synchronous (backward-compatible) ───────────────────────────────────

    @PostMapping("/interview-kit")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Generate interview kit (synchronous)",
               description = "Blocking. Use /interview-kit/async to avoid gateway timeouts.")
    public ResponseEntity<InterviewKitResponse> generateKit(
            @Valid @RequestBody InterviewKitRequest request) {
        UUID userId = AuthUtil.currentUserId();
        log.info("[MockInterview] Sync kit request userId={}", userId);
        InterviewKitResponse kit = mockInterviewService.generateInterviewKit(userId, request);
        return ResponseEntity.ok(kit);
    }

    // ── Async endpoint (B2-G4 fix) ───────────────────────────────────────────

    /**
     * Triggers async interview kit generation on the skillExecutor thread pool.
     * Returns 202 Accepted immediately. Poll GET /interview-kit/result/{jobId}
     * using the X-Kit-Job-Id value from the response header.
     */
    @PostMapping("/interview-kit/async")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Generate interview kit (async, non-blocking)",
               description = "Returns 202 immediately. Poll GET /interview-kit/result/{jobId}.")
    public ResponseEntity<Void> generateKitAsync(
            @Valid @RequestBody InterviewKitRequest request) {
        UUID   userId = AuthUtil.currentUserId();
        String jobId  = UUID.randomUUID().toString();
        log.info("[MockInterview] Async kit request userId={} jobId={}", userId, jobId);
        mockInterviewService.generateInterviewKitAsync(userId, request, jobId);
        return ResponseEntity.accepted()
                .header("X-Kit-Job-Id", jobId)
                .build();
    }

    /**
     * Poll for an async interview kit result.
     * Returns 200 + body when complete, 202 while still running.
     */
    @GetMapping("/interview-kit/result/{jobId}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Poll async interview kit result")
    public ResponseEntity<InterviewKitResponse> getKitResult(@PathVariable String jobId) {
        UUID                 userId = AuthUtil.currentUserId();
        InterviewKitResponse result = mockInterviewService.getKitResult(jobId, userId);
        if (result == null) {
            return ResponseEntity.accepted().build();
        }
        return ResponseEntity.ok(result);
    }
}
