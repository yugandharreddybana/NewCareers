package com.careerops.service;

import com.careerops.exception.ApiException;
import com.careerops.model.DailyFetchLog;
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
    @Value("${jobs.max.per.user.per.day:10}")
    private int maxPerDay;

    public DailyLimitService(DailyFetchLogRepository repo) { this.repo = repo; }

    public int getCount(UUID userId) {
        LocalDate today = LocalDate.now(ZoneId.of("Europe/Dublin"));
        return repo.findByUserIdAndFetchDate(userId, today)
            .map(DailyFetchLog::getCount).orElse(0);
    }

    public int max() { return maxPerDay; }

    public int remaining(UUID userId) { return Math.max(0, maxPerDay - getCount(userId)); }

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
        if (getCount(userId) >= maxPerDay)
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,
                "Daily limit of " + maxPerDay + " jobs reached. Resets at midnight.");
    }
}
