package com.careerops.controller;

import com.careerops.service.PermitIngestionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Admin-only manual trigger for employment permit statistics ingestion.
 */
@RestController
@RequestMapping("/v1/admin")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Admin — Permit ingestion")
public class AdminPermitIngestionController {

    private final PermitIngestionService ingestionService;

    private final ExecutorService manualExecutor = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "permit-ingest-manual");
        t.setDaemon(true);
        return t;
    });

    public record PermitIngestTriggerResponse(
            String jobId,
            Instant startedAt,
            List<String> args
    ) {}

    @PostMapping("/permits/ingest")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Trigger permit stats ingest",
               description = "Runs ingest_permit_stats.py asynchronously with the given flags. Admin only.")
    public ResponseEntity<PermitIngestTriggerResponse> triggerIngest(
            @RequestParam(required = false) Integer year,
            @RequestParam(defaultValue = "false") boolean force,
            @RequestParam(defaultValue = "true") boolean rebuildScores) {

        if (!ingestionService.isEnabled()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }

        List<String> args = ingestionService.buildManualArgs(year, force, rebuildScores);
        String jobId = UUID.randomUUID().toString();
        Instant startedAt = Instant.now();

        manualExecutor.execute(() -> {
            log.info("Manual permit ingest jobId={} starting args={}", jobId, args);
            int exit = ingestionService.run(args);
            log.info("Manual permit ingest jobId={} finished exitCode={}", jobId, exit);
        });

        return ResponseEntity.accepted().body(new PermitIngestTriggerResponse(jobId, startedAt, args));
    }

}
