package com.careerops.dto;

import com.careerops.model.UserProfile.PortfolioItem;

import java.util.List;

public class ProfileDtos {

    // ── Core profile request/response ─────────────────────────────────────────
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
        // Section 10 — career goals
        String    goalTitle,
        Integer   goalSalaryMin,
        Integer   goalSalaryMax,
        String    goalLocation,
        Boolean   openToRemote
    ) {}

    public record ProfileResponse(
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
        String    activeCvFileName,
        // Section 10 — portfolio + career goals
        List<PortfolioItem> portfolioItems,
        String    goalTitle,
        Integer   goalSalaryMin,
        Integer   goalSalaryMax,
        String    goalLocation,
        Boolean   openToRemote
    ) {}

    public record StatsResponse(
        long   total,
        long   applied,
        long   interviews,
        long   offers,
        double avgMatch
    ) {}

    // ── Section 10 — Portfolio CRUD DTOs ────────────────────────────────────────
    public record PortfolioItemRequest(
        String       title,
        String       url,
        String       description,
        List<String> techTags
    ) {}

    // ── Section 10 — LinkedIn import ─────────────────────────────────────────
    public record ImportSummary(
        String   firstName,
        String   lastName,
        String   headline,
        String   summary,
        int      positionsImported,
        int      skillsImported,
        boolean  locationUpdated,
        String   message
    ) {}
}
