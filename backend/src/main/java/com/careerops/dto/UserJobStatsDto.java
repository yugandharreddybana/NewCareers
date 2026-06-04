package com.careerops.dto;

import lombok.Builder;
import lombok.Value;

import java.util.Map;

/**
 * Lightweight stats object cached per-user (TTL 5 min).
 * Avoids re-running COUNT / AVG queries on every dashboard load.
 */
@Value
@Builder
public class UserJobStatsDto {
    long   totalJobs;
    long   favorites;
    Double avgMatchPercent;
    Map<String, Long> byColumn;   // e.g. {"Discovered": 42, "Applied": 7, "Interview": 2}
}
