package com.careerops.service;

import org.jspecify.annotations.Nullable;

import com.careerops.email.WeeklyDigestEmailTemplate;
import com.careerops.email.WeeklyDigestEmailTemplate.TopJob;
import com.careerops.email.WeeklyDigestEmailTemplate.WeekStats;
import com.careerops.model.Notification;
import com.careerops.repository.UserProfileRepository;
import com.careerops.repository.SkillRunRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Section 8 — Task 90
 * WeeklyDigestService
 *
 * Builds and sends a weekly HTML digest to every onboarded user.
 *
 * Per-user algorithm:
 *   1. Resolve user email + first_name from users table
 *   2. Query week stats:
 *        - jobsMatched   : user_jobs created in past 7 days
 *        - skillsRun     : skill_runs created in past 7 days
 *        - appsSent      : user_jobs moved to 'Applied' in past 7 days
 *   3. Query top 3 new jobs (highest match_percent, past 7 days)
 *   4. Render HTML via WeeklyDigestEmailTemplate
 *   5. Send via ResendEmailService
 *   6. Create in-app WEEKLY_DIGEST notification
 */
@Service
public class WeeklyDigestService {

    private static final Logger log = LoggerFactory.getLogger(WeeklyDigestService.class);

    private final UserProfileRepository   profiles;
    private final UserRepository          users;
    private final UserJobRepository       userJobs;
    private final SkillRunRepository      skillRuns;
    private final ResendEmailService      emailService;
    private final NotificationService     notificationService;
    private final UserConsentService      consentService;

    @Value("${app.base-url:http://localhost:5173}")
    private String appBaseUrl;

    public WeeklyDigestService(UserProfileRepository profiles,
                               UserRepository users,
                               UserJobRepository userJobs,
                               SkillRunRepository skillRuns,
                               ResendEmailService emailService,
                               NotificationService notificationService,
                               UserConsentService consentService) {
        this.profiles            = profiles;
        this.users               = users;
        this.userJobs            = userJobs;
        this.skillRuns           = skillRuns;
        this.emailService        = emailService;
        this.notificationService = notificationService;
        this.consentService = consentService;
    }

    // ── Public entry-point (called by CronJobService) ───────────────────────

    public void sendDigestsForAllUsers() {
        int sent = 0, skipped = 0;
        for (var profile : profiles.findAllByOnboardedTrue()) {
            try {
                boolean ok = sendDigestForUser(profile.getUserId());
                if (ok) sent++; else skipped++;
            } catch (Exception e) {
                log.warn("Weekly digest failed for user {}: {}", profile.getUserId(), e.getMessage());
                skipped++;
            }
        }
        log.info("Weekly digest complete: sent={} skipped={}", sent, skipped);
    }

    // ── Per-user digest ─────────────────────────────────────────────────

    @Transactional(timeout = 10, readOnly = true)
    public boolean sendDigestForUser(UUID userId) {
        if (!consentService.hasMarketingConsent(userId)) {
            return false;
        }
        // Step 1 — Resolve contact
        UserContact contact = resolveContact(userId);
        if (contact == null) return false;

        // Step 2 — Week stats
        WeekStats stats = queryWeekStats(userId);

        // Step 3 — Top 3 new jobs
        List<TopJob> topJobs = queryTopJobs(userId);

        // Step 4 — Render + send email
        String html = WeeklyDigestEmailTemplate.render(
                contact.firstName(), stats, topJobs, appBaseUrl);

        String subject = stats.jobsMatched() > 0
                ? "\uD83D\uDCC5 Your week in CareerOps — " + stats.jobsMatched() + " new jobs matched"
                : "\uD83D\uDCC5 Your weekly CareerOps summary";

        emailService.send(contact.email(), subject, html);

        // Step 5 — In-app notification
        String notifBody = stats.jobsMatched() + " jobs matched, "
                + stats.skillsRun() + " skills run, "
                + stats.applicationsSent() + " applications sent this week.";

        notificationService.create(
                userId,
                Notification.TYPE_WEEKLY_DIGEST,
                "\uD83D\uDCC5 Your weekly digest is ready",
                notifBody,
                Map.of(
                    "jobsMatched",      stats.jobsMatched(),
                    "skillsRun",        stats.skillsRun(),
                    "applicationsSent", stats.applicationsSent()
                )
        );

        log.debug("Weekly digest sent to user={} email={}", userId, contact.email());
        return true;
    }

    // ── Queries ─────────────────────────────────────────────────────────

    private WeekStats queryWeekStats(UUID userId) {
        java.time.Instant since = java.time.Instant.now().minus(7, java.time.temporal.ChronoUnit.DAYS);

        long jobsMatched = userJobs.countByUserIdAndDeliveredAtAfter(userId, since);
        long skillsRun   = skillRuns.countByUserIdAndCreatedAtAfter(userId, since);
        long appsSent    = userJobs.countByUserIdAndKanbanColumnAndDeliveredAtAfter(userId, "Applied", since);

        return new WeekStats((int)jobsMatched, (int)skillsRun, (int)appsSent);
    }

    @SuppressWarnings("unchecked")
    private List<TopJob> queryTopJobs(UUID userId) {
        java.time.Instant since = java.time.Instant.now().minus(7, java.time.temporal.ChronoUnit.DAYS);
        
        return userJobs.findTop3ByUserIdAndDeliveredAtAfterAndMatchPercentIsNotNullOrderByMatchPercentDesc(userId, since)
            .stream()
            .map(uj -> new TopJob(
                uj.getId().toString(),
                uj.getJob() != null ? uj.getJob().getTitle() : "",
                uj.getJob() != null ? uj.getJob().getCompany() : "",
                uj.getJob() != null ? uj.getJob().getLocation() : null,
                uj.getMatchPercent() != null ? uj.getMatchPercent() : 0
            ))
            .toList();
    }

    private @Nullable UserContact resolveContact(UUID userId) {
        return users.findById(userId)
                .map(u -> new UserContact(u.getEmail(), u.getName() != null ? u.getName().split(" ")[0] : "there"))
                .orElse(null);
    }

    // Package-private so ResendEmailService can also use the pattern
    void send(String to, String subject, String html) {
        emailService.send(to, subject, html);
    }

    private record UserContact(String email, String firstName) {}
}
