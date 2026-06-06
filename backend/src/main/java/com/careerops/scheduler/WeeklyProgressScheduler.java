package com.careerops.scheduler;

import com.careerops.model.UserStreak;
import com.careerops.model.WeeklyProgressSnapshot;
import com.careerops.repository.UserStreakRepository;
import com.careerops.repository.WeeklyProgressSnapshotRepository;
import com.careerops.repository.FeatureFlagRepository;
import com.careerops.service.UserConsentService;
import com.careerops.service.WeeklyProgressEmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

/**
 * Task 66 — Weekly progress snapshot refresh and email dispatch.
 * Runs every Monday at 08:00 UTC.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WeeklyProgressScheduler {

    private final WeeklyProgressSnapshotRepository snapshotRepo;
    private final UserStreakRepository streakRepo;
    private final WeeklyProgressEmailService progressEmailService;
    private final UserConsentService consentService;
    private final FeatureFlagRepository flagRepo;

    /**
     * This is the CANONICAL and sole source-of-truth scheduler for weekly performance progress emails.
     */
    @Scheduled(cron = "0 0 8 * * MON", zone = "Europe/Dublin")
    public void generateAndSendWeeklyProgress() {
        log.info("[WeeklyProgressScheduler] Starting weekly progress email dispatch");

        boolean digestEnabled = flagRepo.findByFlagKey("EMAIL_DIGEST_ENABLED")
                .map(f -> Boolean.TRUE.equals(f.getEnabled()))
                .orElse(true);
        if (!digestEnabled) {
            log.info("[WeeklyProgressScheduler] Skipped — EMAIL_DIGEST_ENABLED is off");
            return;
        }

        // Retrieve all snapshots for the current week (generated throughout the week
        // by on-demand calls to ProgressInsightService.generateSnapshot)
        LocalDate weekStart = LocalDate.now(ZoneOffset.UTC).with(DayOfWeek.MONDAY);
        List<WeeklyProgressSnapshot> snaps = snapshotRepo
                .findByWeekStartWithUserEmail(weekStart);

        int sent = 0;
        int skipped = 0;

        for (WeeklyProgressSnapshot snap : snaps) {
            try {
                // Fetch streak for personalised email
                Optional<UserStreak> streakOpt = streakRepo.findByUserId(snap.getUserId());
                UserStreak streak = streakOpt.orElse(null);

                // Email and first name come from the join query projection
                String toEmail = snap.getUserEmail();
                String firstName = snap.getUserFirstName();

                if (toEmail == null || toEmail.isBlank()) {
                    skipped++;
                    continue;
                }
                if (!consentService.hasMarketingConsent(snap.getUserId())) {
                    skipped++;
                    continue;
                }

                progressEmailService.sendWeeklyProgressEmail(toEmail, firstName, snap, streak);
                sent++;
            } catch (Exception e) {
                log.error("[WeeklyProgressScheduler] Error for userId={}: {}",
                        snap.getUserId(), e.getMessage());
                skipped++;
            }
        }

        log.info("[WeeklyProgressScheduler] Complete — sent: {}, skipped: {}", sent, skipped);
    }
}
