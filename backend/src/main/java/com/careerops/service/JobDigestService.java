package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.repository.JobRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

/**
 * Builds and sends a daily job digest email to every onboarded user.
 * Called by CronJobService at 09:05 Europe/Dublin after the job delivery cron.
 */
@Service
public class JobDigestService {
    private static final Logger log = LoggerFactory.getLogger(JobDigestService.class);

    private final UserProfileRepository profiles;
    private final UserRepository        users;
    private final UserJobRepository     userJobs;
    private final JobRepository         jobs;
    private final ResendEmailService    email;

    @Value("${app.base-url:http://localhost:5173}")
    private String appBaseUrl;

    private static final int DIGEST_MIN_MATCH = 70;
    private static final int DIGEST_MAX_JOBS  = 5;

    public JobDigestService(UserProfileRepository profiles,
                            UserRepository users,
                            UserJobRepository userJobs,
                            JobRepository jobs,
                            ResendEmailService email) {
        this.profiles = profiles;
        this.users    = users;
        this.userJobs = userJobs;
        this.jobs     = jobs;
        this.email    = email;
    }

    public void sendDigestsForAllUsers() {
        Instant since = Instant.now().minus(24, ChronoUnit.HOURS);

        for (var profile : profiles.findAllByOnboardedTrue()) {
            UUID userId = profile.getUserId();
            try {
                var user = users.findById(userId).orElse(null);
                if (user == null) continue;

                List<ResendEmailService.DigestJob> digestJobs = userJobs
                    .findByUserIdOrderByDeliveredAtDesc(userId).stream()
                    .filter(uj -> uj.getDeliveredAt() != null
                        && uj.getDeliveredAt().isAfter(since)
                        && uj.getMatchPercent() != null
                        && uj.getMatchPercent() >= DIGEST_MIN_MATCH)
                    .sorted((a, b) -> Integer.compare(
                        b.getMatchPercent() == null ? 0 : b.getMatchPercent(),
                        a.getMatchPercent() == null ? 0 : a.getMatchPercent()))
                    .limit(DIGEST_MAX_JOBS)
                    .map(uj -> {
                        Job j = jobs.findById(uj.getJobId()).orElse(null);
                        if (j == null) return null;
                        return new ResendEmailService.DigestJob(
                            uj.getId().toString(),
                            j.getTitle(),
                            j.getCompany(),
                            j.getLocation(),
                            uj.getMatchPercent(),
                            uj.getHumanSummary(),
                            j.getSourceUrl()
                        );
                    })
                    .filter(d -> d != null)
                    .toList();

                if (digestJobs.isEmpty()) continue;

                String firstName = user.getName() != null
                    ? user.getName().split(" ")[0]
                    : "there";

                email.sendJobDigest(user.getEmail(), firstName, digestJobs, appBaseUrl);
                log.info("Digest sent to {} ({} jobs)", user.getEmail(), digestJobs.size());

            } catch (Exception e) {
                log.warn("Digest failed for userId={}: {}", userId, e.getMessage());
            }
        }
    }
}
