package com.careerops.scheduler;

import com.careerops.repository.PermitSnapshotRepository;
import com.careerops.service.PermitIngestionService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Schedules enterprise.gov.ie permit statistics ingestion via {@code ingest_permit_stats.py}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PermitIngestionScheduler {

    private static final ZoneId DUBLIN = ZoneId.of("Europe/Dublin");

    private final PermitIngestionService ingestionService;
    private final PermitSnapshotRepository snapshotRepository;

    private final ExecutorService bootstrapExecutor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "permit-ingest-bootstrap");
        t.setDaemon(true);
        return t;
    });

    @PostConstruct
    void triggerFirstRunIfEmpty() {
        if (!ingestionService.isEnabled()) {
            return;
        }
        long count = snapshotRepository.count();
        if (count > 0) {
            log.debug("Permit snapshots present (count={}); skipping seed ingest", count);
            return;
        }
        log.info("permit_snapshots is empty — scheduling initial --all ingest on bootstrap");
        bootstrapExecutor.execute(() -> {
            int exit = ingestionService.run(ingestionService.buildSeedAllArgs());
            if (exit != 0) {
                log.error("Initial permit seed ingest finished with exit code {}", exit);
            }
        });
    }

    @Scheduled(cron = "0 0 3 * * *", zone = "Europe/Dublin")
    @SchedulerLock(name = "permitIngestDailyLive", lockAtMostFor = "6h", lockAtLeastFor = "5m")
    public void runDailyLive() {
        if (!ingestionService.isEnabled()) {
            return;
        }
        log.info("Running scheduled live permit ingest");
        ingestionService.run(ingestionService.buildLiveOnlyArgs());
    }

    @Scheduled(cron = "0 0 2 1 1 *", zone = "Europe/Dublin")
    @SchedulerLock(name = "permitIngestAnnualBackfill", lockAtMostFor = "12h", lockAtLeastFor = "30m")
    public void runAnnualBackfill() {
        if (!ingestionService.isEnabled()) {
            return;
        }
        int previousYear = ZonedDateTime.now(DUBLIN).getYear() - 1;
        log.info("Running annual permit backfill for year {}", previousYear);
        ingestionService.run(ingestionService.buildAnnualArgs(previousYear));
    }
}
