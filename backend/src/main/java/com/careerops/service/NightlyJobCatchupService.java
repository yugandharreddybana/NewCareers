package com.careerops.service;

import com.careerops.debug.DebugSessionLog;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Lazy;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * When the JVM starts after the 06:00 Europe/Dublin nightly fetch window (e.g. laptop slept),
 * runs the missed fetch + score pipeline once per day.
 */
@Service
public class NightlyJobCatchupService {

    private static final Logger log = LoggerFactory.getLogger(NightlyJobCatchupService.class);

    private final CronJobService cronJobs;
    private final ShedlockLastRunProbe shedlock;
    private final NightlyJobCatchupService self;
    private final boolean catchupEnabled;

    public NightlyJobCatchupService(
            CronJobService cronJobs,
            ShedlockLastRunProbe shedlock,
            @Lazy NightlyJobCatchupService self,
            @Value("${jobs.nightly.catchup-on-startup:false}") boolean catchupEnabled) {
        this.cronJobs = cronJobs;
        this.shedlock = shedlock;
        this.self = self;
        this.catchupEnabled = catchupEnabled;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void scheduleCatchupAfterStartup() {
        if (!catchupEnabled) {
            log.debug("Nightly job catch-up on startup is disabled");
            return;
        }
        CompletableFuture.runAsync(() -> {
            try {
                Thread.sleep(15_000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
            self.runCatchupIfMissed();
        });
    }

    @SchedulerLock(name = "nightly_job_catchup", lockAtMostFor = "90m", lockAtLeastFor = "2m")
    public void runCatchupIfMissed() {
        LocalDate today = LocalDate.now(ShedlockLastRunProbe.DUBLIN);
        LocalTime now = LocalTime.now(ShedlockLastRunProbe.DUBLIN);

        if (now.isBefore(LocalTime.of(6, 0))) {
            log.debug("Nightly catch-up skipped: before 06:00 Dublin (now={})", now);
            return;
        }

        if (shedlock.ranOnLocalDate("nightly_job_score", today, ShedlockLastRunProbe.DUBLIN)) {
            log.info("Nightly catch-up skipped: nightly_job_score already ran today ({})", today);
            // #region agent log
            DebugSessionLog.write(
                    "NightlyJobCatchupService.runCatchupIfMissed",
                    "catch-up skipped score already ran",
                    "H1",
                    Map.of("today", today.toString(), "dublinNow", now.toString(), "action", "skip"));
            // #endregion
            return;
        }

        log.info("Nightly catch-up starting — missed 06:00 Dublin cron while JVM was down (date={})", today);
        // #region agent log
        DebugSessionLog.write(
                "NightlyJobCatchupService.runCatchupIfMissed",
                "catch-up starting missed nightly pipeline",
                "H1",
                Map.of("today", today.toString(), "dublinNow", now.toString(), "action", "run"));
        // #endregion

        cronJobs.nightlyJobFetch();
        cronJobs.nightlyJobScore();

        log.info("Nightly catch-up complete for {}", today);
        // #region agent log
        DebugSessionLog.write(
                "NightlyJobCatchupService.runCatchupIfMissed",
                "catch-up finished",
                "H1",
                Map.of("today", today.toString(), "action", "complete"));
        // #endregion
    }
}
