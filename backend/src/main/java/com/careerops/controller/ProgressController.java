package com.careerops.controller;

import com.careerops.dto.ProgressDTO;
import com.careerops.service.ProgressInsightService;
import com.careerops.util.AuthUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * CORS Policy:
 * - Allowed Origins: from ${cors.allowed.origins}
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Internal-Secret, X-Internal-User-Id
 * - Exposed: X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 */
@RestController
@RequestMapping("/progress")
@io.micrometer.core.annotation.Timed
@RequiredArgsConstructor
public class ProgressController {

    private final ProgressInsightService progressService;

    // Task 61 — GET /progress/weekly-summary  (current week)
    @GetMapping("/weekly-summary")
    public ProgressDTO.WeeklySummaryResponse weeklySummary() {
        UUID userId = AuthUtil.currentUserId();
        return progressService.getWeeklySummary(userId);
    }

    // Task 62 — GET /progress/streaks
    @GetMapping("/streaks")
    public ProgressDTO.StreakResponse streaks() {
        UUID userId = AuthUtil.currentUserId();
        return progressService.getStreaks(userId);
    }

    // POST /progress/activity — record daily activity + update streak
    @PostMapping("/activity")
    public ProgressDTO.StreakResponse recordActivity() {
        UUID userId = AuthUtil.currentUserId();
        return progressService.recordDailyActivity(userId);
    }

    // Task 67 — GET /progress/history?weeks=8 (for multi-week chart)
    @GetMapping("/history")
    public List<ProgressDTO.WeeklySummaryResponse> history(
            @RequestParam(defaultValue = "8") int weeks) {
        UUID userId = AuthUtil.currentUserId();
        return progressService.getHistory(userId, weeks);
    }

    // Task 68 — GET /progress/full (history + streaks in one call for ProgressPage)
    @GetMapping("/full")
    public ProgressDTO.HistoryResponse full() {
        UUID userId = AuthUtil.currentUserId();
        return progressService.getFullHistory(userId);
    }
}
