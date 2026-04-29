package com.careerops.service;

import com.careerops.exception.ApiException;
import com.careerops.model.DailyFetchLog;
import com.careerops.repository.DailyFetchLogRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

@Service
public class DailyLimitService {

    private final DailyFetchLogRepository repo;
    @Value("${jobs.max.per.user.per.day:10}")
    private int maxPerDay;

    public DailyLimitService(DailyFetchLogRepository repo) { this.repo = repo; }

    public int getCount(UUID userId) {
        return repo.findByUserIdAndFetchDate(userId, LocalDate.now())
            .map(DailyFetchLog::getCount).orElse(0);
    }

    public int max() { return maxPerDay; }

    public int remaining(UUID userId) { return Math.max(0, maxPerDay - getCount(userId)); }

    @Transactional
    public int increment(UUID userId, int delta) {
        DailyFetchLog log = repo.findByUserIdAndFetchDate(userId, LocalDate.now())
            .orElseGet(() -> DailyFetchLog.builder().userId(userId).fetchDate(LocalDate.now()).count(0).build());
        log.setCount((log.getCount() == null ? 0 : log.getCount()) + delta);
        repo.save(log);
        return log.getCount();
    }

    public void assertCanFetch(UUID userId) {
        if (getCount(userId) >= maxPerDay)
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,
                "Daily limit of " + maxPerDay + " jobs reached. Resets at midnight.");
    }
}
