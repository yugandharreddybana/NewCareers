package com.careerops.service;

import com.careerops.config.CacheConfig;
import com.careerops.dto.UserJobStatsDto;
import com.careerops.repository.UserJobRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Batch 4 – stats service with a write-through cache.
 *
 * getStats()    → cached per userId; returns immediately on subsequent calls
 *                 within the same JVM lifetime (evicted on any write).
 * evictStats()  → called by UserJobService whenever a job is saved, updated,
 *                 or deleted so the next read recomputes fresh values.
 */
@Service
@RequiredArgsConstructor
public class UserJobStatsService {

    private final UserJobRepository userJobRepository;

    @Cacheable(value = CacheConfig.CACHE_USER_JOB_STATS, key = "#userId")
    public UserJobStatsDto getStats(UUID userId) {
        long total     = userJobRepository.countByUserId(userId);
        long favorites = userJobRepository.countFavoritesByUserId(userId);
        Double avg     = userJobRepository.avgMatchPercentByUserId(userId);

        List<Object[]> rows = userJobRepository.countByUserIdGroupByColumn(userId);
        Map<String, Long> byColumn = new LinkedHashMap<>();
        for (Object[] row : rows) {
            byColumn.put((String) row[0], (Long) row[1]);
        }

        return UserJobStatsDto.builder()
                .totalJobs(total)
                .favorites(favorites)
                .avgMatchPercent(avg)
                .byColumn(byColumn)
                .build();
    }

    @CacheEvict(value = CacheConfig.CACHE_USER_JOB_STATS, key = "#userId")
    public void evictStats(UUID userId) {
        // Annotation drives the eviction; no body needed.
    }
}
