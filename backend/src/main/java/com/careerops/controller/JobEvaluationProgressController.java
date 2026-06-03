package com.careerops.controller;

import com.careerops.service.JobEvaluationProgressStore;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.UUID;

/**
 * SSE endpoint for real-time onboarding job evaluation progress.
 *
 * Frontend connects here BEFORE triggering "Complete Profile" / onboarding delivery.
 * The stream stays open and receives events:
 *   - SOURCE_FOUND   — per source (IrishJobs, LinkedIn, Indeed, etc.) once scraped
 *   - JOB_EVALUATED  — once per job as it is evaluated
 *   - COMPLETE       — when all jobs are evaluated; triggers frontend redirect to dashboard
 *
 * Timeout: 10 minutes — enough for the full onboarding pipeline even under load.
 */
@RestController
@RequestMapping("/api/jobs")
public class JobEvaluationProgressController {

    private final JobEvaluationProgressStore progressStore;

    @Autowired
    public JobEvaluationProgressController(JobEvaluationProgressStore progressStore) {
        this.progressStore = progressStore;
    }

    /**
     * Open an SSE stream for the given user's onboarding progress.
     *
     * @param userId the authenticated user's UUID (from query param; frontend reads from auth context)
     * @return a live SSE stream of OnboardingProgressEvent JSON objects
     */
    @GetMapping(value = "/evaluation-progress", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamProgress(@RequestParam UUID userId) {
        // 10-minute timeout — generous enough for 100+ job evaluations
        SseEmitter emitter = new SseEmitter(600_000L);
        progressStore.registerEmitter(userId, emitter);
        return emitter;
    }
}
