package com.careerops.dto;

import lombok.Builder;
import lombok.Value;

import java.util.Map;

/**
 * Immutable DTO returned by {@link com.careerops.service.JobStatsService}.
 * Must be serializable by Jackson for Redis caching.
 */
@Value
@Builder
public class JobStatsDto {

    long totalJobs;
    double avgMatchPercent;
    long jobsWithAiScore;

    /** kanban column name → count, e.g. {"Applied": 12, "Interview": 3} */
    Map<String, Long> byKanbanColumn;
}
