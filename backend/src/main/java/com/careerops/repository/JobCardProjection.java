package com.careerops.repository;

import java.time.Instant;
import java.util.UUID;

/**
 * Minimal read-only projection returned by paginated job-list queries.
 * Avoids loading heavy JSONB columns (score_breakdown) and text[] arrays
 * that are only needed on the job detail page.
 */
public interface JobCardProjection {
    UUID   getUserJobId();
    UUID   getJobId();
    String getTitle();
    String getCompany();
    String getLocation();
    String getJobType();
    String getSource();
    Integer getMatchPercent();
    String getStatus();
    String getKanbanColumn();
    boolean getIsFavorite();
    Instant getDeliveredAt();
}
