package com.careerops.dto;

import java.util.List;
import java.util.Map;

/**
 * Section 10 — updated to include portfolio, goal fields, LinkedIn import summary.
 */
public class ProfileDtos {

    // ── Core profile CRUD ───────────────────────────────────────────────────

    public record ProfileRequest(
        String[] targetRoles,
        String[] techStack,
        String   location,
        Integer  salaryMin,
        Integer  salaryMax,
        String[] sectors,
        Integer  freshnessHours,
        Integer  minMatchPercent,
        Boolean  sponsorshipRequired,
        Boolean  onboarded,
        // Section 10 goal fields
        String  goalTitle,
        Integer goalSalaryMin,
        Integer goalSalaryMax,
        String  goalLocation,
        Boolean openToRemote
    ) {}

    public record ProfileResponse(
        String[] targetRoles,
        String[] techStack,
        String   location,
        Integer  salaryMin,
        Integer  salaryMax,
        String[] sectors,
        Integer  freshnessHours,
        Integer  minMatchPercent,
        Boolean  sponsorshipRequired,
        Boolean  onboarded,
        String   activeCvFileName,
        // Section 10
        List<Map<String, Object>> portfolioItems,
        String  goalTitle,
        Integer goalSalaryMin,
        Integer goalSalaryMax,
        String  goalLocation,
        Boolean openToRemote,
        int     completenessScore
    ) {}

    public record StatsResponse(
        long   total,
        long   applied,
        long   interviews,
        long   offers,
        double avgMatch
    ) {}

    // ── Portfolio item operations ───────────────────────────────────────────

    public record PortfolioItemRequest(
        String       id,           // null = create, non-null = update
        String       title,
        String       url,
        String       description,
        List<String> techTags
    ) {}

    public record DeletePortfolioItemRequest(String id) {}

    // ── LinkedIn import ─────────────────────────────────────────────────────

    public record ImportSummary(
        String  firstName,
        String  lastName,
        String  headline,
        String  location,
        int     positionsImported,
        int     skillsImported,
        boolean profileUpdated,
        String  message
    ) {}
}
