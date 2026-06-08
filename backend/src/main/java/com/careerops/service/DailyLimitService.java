package com.careerops.service;

import com.careerops.exception.ApiException;
import com.careerops.model.DailyFetchLog;
import com.careerops.model.PlanTier;
import com.careerops.model.PlanTierLimits;
import com.careerops.repository.DailyFetchLogRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

@Service
public class DailyLimitService {

    private final DailyFetchLogRepository repo;
    private final UserPlanTierService planTierService;
    @Value("${jobs.daily.cap:${jobs.max.per.user.per.day:25}}")
    private int maxPerDay;

    public DailyLimitService(DailyFetchLogRepository repo, UserPlanTierService planTierService) {
        this.repo = repo;
        this.planTierService = planTierService;
    }

    public int getCount(UUID userId) {
        LocalDate today = LocalDate.now(ZoneId.of("Europe/Dublin"));
        return repo.findByUserIdAndFetchDate(userId, today)
            .map(DailyFetchLog::getCount).orElse(0);
    }

    public int max() { return maxPerDay; }

    public int maxFor(PlanTier tier) {
        return PlanTierLimits.jobCap(tier);
    }

    public int maxForUser(UUID userId) {
        return PlanTierLimits.jobCap(planTierService.resolveForUser(userId));
    }

    public int remaining(UUID userId) {
        return Math.max(0, maxForUser(userId) - getCount(userId));
    }

    @Transactional(timeout = 10)
    public int increment(UUID userId, int delta) {
        LocalDate today = LocalDate.now(ZoneId.of("Europe/Dublin"));
        DailyFetchLog log = repo.findByUserIdAndFetchDate(userId, today)
            .orElseGet(() -> DailyFetchLog.builder().userId(userId).fetchDate(today).count(0).build());
        log.setCount((log.getCount() == null ? 0 : log.getCount()) + delta);
        repo.save(log);
        return log.getCount();
    }

    public void assertCanFetch(UUID userId) {
        if (getCount(userId) >= maxForUser(userId))
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, JobFetchSettings.dailyLimitMessage());
    }
}
