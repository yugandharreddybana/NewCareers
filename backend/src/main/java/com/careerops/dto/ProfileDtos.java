package com.careerops.dto;

import java.util.List;
import java.util.Map;

public class ProfileDtos {

    // ── Core profile request (preferences + goals + portfolio together) ───────

    public record ProfileRequest(
        String[] targetRoles,
        String[]  techStack,
        String    location,
        Integer   salaryMin,
        Integer   salaryMax,
        String[]  sectors,
        Integer   freshnessHours,
        Integer   minMatchPercent,
        Boolean   sponsorshipRequired,
        Boolean   onboarded,
        // Section 10 — Career goal fields
        String    goalTitle,
        Integer   goalSalaryMin,
        Integer   goalSalaryMax,
        String    goalLocation,
        Boolean   openToRemote
    ) {}

    // ── Portfolio CRUD requests ───────────────────────────────────────────────

    /** Add or update a single portfolio project */
    public record PortfolioItemRequest(
        String       id,           // null = create, non-null = update
        String       title,
        String       url,
        String       description,
        List<String> techTags
    ) {}

    // ── Profile response ──────────────────────────────────────────────────────

    public record ProfileResponse(
        String[]              targetRoles,
        String[]              techStack,
        String                location,
        Integer               salaryMin,
        Integer               salaryMax,
        String[]              sectors,
        Integer               freshnessHours,
        Integer               minMatchPercent,
        Boolean               sponsorshipRequired,
        Boolean               onboarded,
        String                activeCvFileName,
        // Section 10 — Career goals
        String                goalTitle,
        Integer               goalSalaryMin,
        Integer               goalSalaryMax,
        String                goalLocation,
        Boolean               openToRemote,
        // Section 10 — Portfolio
        List<Map<String,Object>> portfolioItems,
        // Section 10 — Completeness
        int                   completenessScore
    ) {}

    // ── Stats response ────────────────────────────────────────────────────────

    public record StatsResponse(
        long total, long applied, long interviews, long offers, double avgMatch
    ) {}

    // ── LinkedIn import summary ───────────────────────────────────────────────

    public record ImportSummary(
        String  firstName,
        String  lastName,
        String  headline,
        String  location,
        int     skillsImported,
        int     positionsImported,
        boolean profileUpdated
    ) {}
}
