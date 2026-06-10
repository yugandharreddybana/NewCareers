package com.careerops.service;

import com.careerops.exception.ApiException;
import com.careerops.model.DailyFetchLog;
import com.careerops.model.Job;
import com.careerops.model.PlanTier;
import com.careerops.model.PlanTierLimits;
import com.careerops.model.UserJob;
import com.careerops.model.UserProfile;
import com.careerops.repository.DailyFetchLogRepository;
import com.careerops.repository.JobRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class DailyLimitService {

    static final ZoneId QUOTA_ZONE = ZoneId.of("Europe/Dublin");

    private final DailyFetchLogRepository repo;
    private final UserPlanTierService planTierService;
    private final UserQuotaGrantService quotaGrantService;
    private final UserJobRepository userJobs;
    private final JobRepository jobs;
    private final UserProfileRepository profiles;
    @Value("${jobs.daily.cap:${jobs.max.per.user.per.day:25}}")
    private int maxPerDay;

    public DailyLimitService(
            DailyFetchLogRepository repo,
            UserPlanTierService planTierService,
            UserQuotaGrantService quotaGrantService,
            UserJobRepository userJobs,
            JobRepository jobs,
            UserProfileRepository profiles) {
        this.repo = repo;
        this.planTierService = planTierService;
        this.quotaGrantService = quotaGrantService;
        this.userJobs = userJobs;
        this.jobs = jobs;
        this.profiles = profiles;
    }

    /**
     * Jobs delivered today that meet the same visibility rules as GET /jobs
     * (profile min-match % and desired-role title filter).
     */
    public int getCount(UUID userId) {
        UserProfile profile = profiles.findByUserId(userId).orElse(null);
        if (profile == null) {
            return 0;
        }
        List<UserJob> delivered = userJobs.findActiveDeliveredSince(userId, startOfQuotaDay());
        if (delivered.isEmpty()) {
            return 0;
        }
        Set<UUID> jobIds = delivered.stream().map(UserJob::getJobId).collect(Collectors.toSet());
        Map<UUID, Job> jobMap = new HashMap<>();
        for (Job job : jobs.findAllById(jobIds)) {
            jobMap.put(job.getId(), job);
        }
        int count = 0;
        for (UserJob uj : delivered) {
            Integer match = uj.getMatchPercent();
            if (match == null || !JobProfileMatchPolicy.meetsMinMatch(match, profile)) {
                continue;
            }
            Job job = jobMap.get(uj.getJobId());
            if (job != null && JobDeliveryFilters.titleMatchesDesiredRoles(profile, job.getTitle())) {
                count++;
            }
        }
        return count;
    }

    static Instant startOfQuotaDay() {
        return LocalDate.now(QUOTA_ZONE).atStartOfDay(QUOTA_ZONE).toInstant();
    }

    public int max() { return maxPerDay; }

    public int maxFor(PlanTier tier) {
        return PlanTierLimits.jobCap(tier);
    }

    public int maxForUser(UUID userId) {
        PlanTier tier = planTierService.resolveForUser(userId);
        return quotaGrantService.jobsPerDay(userId, tier);
    }

    public int remaining(UUID userId) {
        return Math.max(0, maxForUser(userId) - getCount(userId));
    }

    @Transactional(timeout = 10)
    public int increment(UUID userId, int delta) {
        LocalDate today = LocalDate.now(QUOTA_ZONE);
        DailyFetchLog log = repo.findByUserIdAndFetchDate(userId, today)
            .orElseGet(() -> DailyFetchLog.builder().userId(userId).fetchDate(today).count(0).build());
        log.setCount((log.getCount() == null ? 0 : log.getCount()) + delta);
        repo.save(log);
        return getCount(userId);
    }

    public void assertCanFetch(UUID userId) {
        if (quotaGrantService.unlimitedAccess(userId)) {
            return;
        }
        if (getCount(userId) >= maxForUser(userId))
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, JobFetchSettings.dailyLimitMessage());
    }
}
