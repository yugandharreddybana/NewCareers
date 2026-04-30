package com.careerops.service;

import com.careerops.email.WeeklyDigestEmailTemplate;
import com.careerops.email.WeeklyDigestEmailTemplate.TopJob;
import com.careerops.email.WeeklyDigestEmailTemplate.WeekStats;
import com.careerops.model.Notification;
import com.careerops.repository.UserProfileRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
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

    @PersistenceContext
    private EntityManager em;

    private final UserProfileRepository   profiles;
    private final ResendEmailService      emailService;
    private final NotificationService     notificationService;

    @Value("${app.base-url:http://localhost:5173}")
    private String appBaseUrl;

    public WeeklyDigestService(UserProfileRepository profiles,
                               ResendEmailService emailService,
                               NotificationService notificationService) {
        this.profiles            = profiles;
        this.emailService        = emailService;
        this.notificationService = notificationService;
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

    @Transactional(readOnly = true)
    public boolean sendDigestForUser(UUID userId) {
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
        // Jobs matched this week
        Number jobsMatched = (Number) em.createNativeQuery("""
                SELECT COUNT(*) FROM career_operations.user_jobs
                WHERE user_id = :uid AND created_at >= NOW() - INTERVAL '7 days'
                """)
                .setParameter("uid", userId)
                .getSingleResult();

        // Skills run this week
        Number skillsRun = (Number) em.createNativeQuery("""
                SELECT COUNT(*) FROM career_operations.skill_runs
                WHERE user_id = :uid AND created_at >= NOW() - INTERVAL '7 days'
                """)
                .setParameter("uid", userId)
                .getSingleResult();

        // Applications sent this week (cards moved to Applied)
        Number appsSent = (Number) em.createNativeQuery("""
                SELECT COUNT(*) FROM career_operations.user_jobs
                WHERE user_id       = :uid
                  AND kanban_column = 'Applied'
                  AND updated_at   >= NOW() - INTERVAL '7 days'
                """)
                .setParameter("uid", userId)
                .getSingleResult();

        return new WeekStats(
                jobsMatched.intValue(),
                skillsRun.intValue(),
                appsSent.intValue()
        );
    }

    @SuppressWarnings("unchecked")
    private List<TopJob> queryTopJobs(UUID userId) {
        List<Object[]> rows = em.createNativeQuery("""
                SELECT uj.id, j.title, j.company, j.location, uj.match_percent
                FROM career_operations.user_jobs uj
                JOIN career_operations.jobs j ON j.id = uj.job_id
                WHERE uj.user_id        = :uid
                  AND uj.created_at    >= NOW() - INTERVAL '7 days'
                  AND uj.match_percent  IS NOT NULL
                ORDER BY uj.match_percent DESC
                LIMIT 3
                """)
                .setParameter("uid", userId)
                .getResultList();

        List<TopJob> result = new ArrayList<>();
        for (Object[] row : rows) {
            result.add(new TopJob(
                row[0] != null ? row[0].toString() : "",
                row[1] instanceof String s ? s : "",
                row[2] instanceof String s ? s : "",
                row[3] instanceof String s ? s : null,
                row[4] != null ? ((Number) row[4]).intValue() : 0
            ));
        }
        return result;
    }

    private UserContact resolveContact(UUID userId) {
        try {
            Object[] row = (Object[]) em.createNativeQuery(
                    "SELECT email, first_name FROM career_operations.users WHERE id = :uid")
                    .setParameter("uid", userId)
                    .getSingleResult();
            String email     = row[0] instanceof String s ? s : null;
            String firstName = row[1] instanceof String n ? n : "there";
            if (email == null || email.isBlank()) return null;
            return new UserContact(email, firstName);
        } catch (Exception e) {
            log.warn("resolveContact failed for userId={}: {}", userId, e.getMessage());
            return null;
        }
    }

    // Package-private so ResendEmailService can also use the pattern
    void send(String to, String subject, String html) {
        emailService.send(to, subject, html);
    }

    private record UserContact(String email, String firstName) {}
}
