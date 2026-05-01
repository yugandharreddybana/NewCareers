package com.careerops.controller;

import com.careerops.dto.ProgressDTO;
import com.careerops.service.ProgressInsightService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/progress")
@RequiredArgsConstructor
public class ProgressController {

    private final ProgressInsightService progressService;

    // Task 61 — GET /progress/weekly-summary  (current week)
    @GetMapping("/weekly-summary")
    public ResponseEntity<ProgressDTO.WeeklySummaryResponse> weeklySummary(
            @AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(progressService.getWeeklySummary(userId));
    }

    // Task 62 — GET /progress/streaks
    @GetMapping("/streaks")
    public ResponseEntity<ProgressDTO.StreakResponse> streaks(
            @AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(progressService.getStreaks(userId));
    }

    // POST /progress/activity — record daily activity + update streak
    @PostMapping("/activity")
    public ResponseEntity<ProgressDTO.StreakResponse> recordActivity(
            @AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(progressService.recordDailyActivity(userId));
    }

    // Task 67 — GET /progress/history?weeks=8 (for multi-week chart)
    @GetMapping("/history")
    public ResponseEntity<List<ProgressDTO.WeeklySummaryResponse>> history(
            @AuthenticationPrincipal UUID userId,
            @RequestParam(defaultValue = "8") int weeks) {
        return ResponseEntity.ok(progressService.getHistory(userId, weeks));
    }

    // Task 68 — GET /progress/full (history + streaks in one call for ProgressPage)
    @GetMapping("/full")
    public ResponseEntity<ProgressDTO.HistoryResponse> full(
            @AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(progressService.getFullHistory(userId));
    }
}
