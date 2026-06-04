package com.careerops.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * Thin read-only projection for job-list (card) endpoints.
 * Only the fields rendered on a card are fetched from the DB –
 * heavy columns (score_breakdown JSONB, full description, etc.)
 * are intentionally excluded and fetched only on the detail endpoint.
 *
 * Spring Data JPA resolves this interface projection via a SQL
 * SELECT that names exactly these columns, so no extra data travels
 * over the wire.
 */
public interface JobCardProjection {

    UUID   getId();
    UUID   getUserId();

    // ── Job fields (joined from jobs table) ──────────────────
    String getTitle();
    String getCompany();
    String getLocation();
    String getSource();
    String getEmploymentType();

    // ── UserJob tracking fields ───────────────────────────────
    String   getKanbanColumn();
    Integer  getMatchPercent();
    Boolean  getIsFavorite();
    Boolean  getIsNew();
    Instant  getDeliveredAt();

    // Salary preview (nullable)
    String getSalaryCurrency();
    Integer getSalaryMin();
    Integer getSalaryMax();
}
