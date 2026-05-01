package com.careerops.controller;

import com.careerops.dto.ProgressDTO;
import com.careerops.service.ProgressInsightService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/progress")
@RequiredArgsConstructor
public class ProgressController {

    private final ProgressInsightService progressService;

    // Task 61 — GET /progress/weekly-summary
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
}
