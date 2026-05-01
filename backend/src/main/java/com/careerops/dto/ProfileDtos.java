package com.careerops.dto;

import com.careerops.model.UserProfile.PortfolioItem;

import java.util.List;

/**
 * Section 10 — Task 106 (updated DTOs)
 * Added: portfolio + goal fields to ProfileRequest/ProfileResponse.
 * Added: PortfolioItemRequest, ImportSummary.
 */
public class ProfileDtos {

    // ── Core profile request ─────────────────────────────────────────────

    public record ProfileRequest(
        String[]  targetRoles,
        String[]  techStack,
        String    location,
        Integer   salaryMin,
        Integer   salaryMax,
        String[]  sectors,
        Integer   freshnessHours,
        Integer   minMatchPercent,
        Boolean   sponsorshipRequired,
        Boolean   onboarded,
        // Section 10 — goal fields
        String    goalTitle,
        Integer   goalSalaryMin,
        Integer   goalSalaryMax,
        String    goalLocation,
        Boolean   openToRemote
    ) {}

    // ── Core profile response ────────────────────────────────────────────

    public record ProfileResponse(
        String[]            targetRoles,
        String[]            techStack,
        String              location,
        Integer             salaryMin,
        Integer             salaryMax,
        String[]            sectors,
        Integer             freshnessHours,
        Integer             minMatchPercent,
        Boolean             sponsorshipRequired,
        Boolean             onboarded,
        String              activeCvFileName,
        // Section 10
        List<PortfolioItem> portfolioItems,
        String              goalTitle,
        Integer             goalSalaryMin,
        Integer             goalSalaryMax,
        String              goalLocation,
        Boolean             openToRemote,
        Integer             completenessScore
    ) {}

    // ── Stats ────────────────────────────────────────────────────────────

    public record StatsResponse(
        long   total,
        long   applied,
        long   interviews,
        long   offers,
        double avgMatch
    ) {}

    // ── Portfolio item request ────────────────────────────────────────────

    public record PortfolioItemRequest(
        String       title,
        String       url,
        String       description,
        List<String> techTags
    ) {}

    // ── LinkedIn import result ────────────────────────────────────────────

    public record ImportSummary(
        String  firstName,
        String  lastName,
        String  headline,
        String  location,
        int     positionsImported,
        int     skillsImported,
        boolean techStackUpdated,
        boolean targetRolesUpdated,
        boolean locationUpdated
    ) {}
}
