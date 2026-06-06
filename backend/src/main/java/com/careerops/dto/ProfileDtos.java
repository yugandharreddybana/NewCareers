package com.careerops.dto;

import com.careerops.model.UserProfile.EducationEntry;
import com.careerops.model.UserProfile.PortfolioItem;
import com.careerops.model.UserProfile.WorkExperienceEntry;

import java.util.List;

/**
 * Section 10 — Task 106 (updated DTOs)
 * Added: portfolio + goal fields to ProfileRequest/ProfileResponse.
 * Added: PortfolioItemRequest, ImportSummary.
 */
public class ProfileDtos {

    // ── Core profile request ─────────────────────────────────────────────

    public record ProfileRequest(
        @jakarta.validation.constraints.Size(max = 100, message = "Name too long")
        String    name,

        @jakarta.validation.constraints.Size(max = 10, message = "Maximum 10 target roles allowed")
        String[]  targetRoles,

        @jakarta.validation.constraints.Size(max = 20, message = "Maximum 20 technologies allowed")
        String[]  techStack,

        @jakarta.validation.constraints.Size(max = 100, message = "Location string too long")
        String    location,

        @jakarta.validation.constraints.Min(value = 0, message = "Salary cannot be negative")
        Integer   salaryMin,

        @jakarta.validation.constraints.Min(value = 0, message = "Salary cannot be negative")
        Integer   salaryMax,

        @jakarta.validation.constraints.Size(max = 8, message = "Currency code too long")
        String    salaryCurrency,

        String[]  sectors,

        @jakarta.validation.constraints.Min(value = 1, message = "Freshness must be at least 1 hour")
        @jakarta.validation.constraints.Max(value = 720, message = "Freshness cannot exceed 30 days")
        Integer   freshnessHours,

        @jakarta.validation.constraints.Min(value = 0, message = "Percent must be 0-100")
        @jakarta.validation.constraints.Max(value = 100, message = "Percent must be 0-100")
        Integer   minMatchPercent,

        Boolean   sponsorshipRequired,
        Boolean   onboarded,

        // Section 10 — goal fields
        @jakarta.validation.constraints.Size(max = 100, message = "Goal title too long")
        String    goalTitle,

        @jakarta.validation.constraints.Size(max = 100, message = "Goal location too long")
        String    goalLocation,

        Boolean   openToRemote,

        String    experienceLevel,

        @jakarta.validation.constraints.Size(max = 20, message = "Maximum 20 work entries allowed")
        List<WorkExperienceEntry> workExperience,

        @jakarta.validation.constraints.Size(max = 20, message = "Maximum 20 education entries allowed")
        List<EducationEntry> education,

        @jakarta.validation.constraints.Size(max = 32, message = "Remote policy too long")
        String    remotePolicy,

        @jakarta.validation.constraints.Size(max = 64, message = "Hybrid days value too long")
        String    hybridOnsiteDays,

        @jakarta.validation.constraints.Size(max = 64, message = "Availability value too long")
        String    availability,

        @jakarta.validation.constraints.Size(max = 32, message = "Job domain too long")
        String    jobDomain
    ) {}

    // ── Core profile response ────────────────────────────────────────────

    public record ProfileResponse(
        String[]            targetRoles,
        String[]            techStack,
        String              location,
        Integer             salaryMin,
        Integer             salaryMax,
        String              salaryCurrency,
        String[]            sectors,
        Integer             freshnessHours,
        Integer             minMatchPercent,
        Boolean             sponsorshipRequired,
        Boolean             onboarded,
        String              activeCvFileName,
        String              activeCvId,
        // Section 10
        List<PortfolioItem> portfolioItems,
        String              goalTitle,
        String              goalLocation,
        Boolean             openToRemote,
        String              experienceLevel,
        List<WorkExperienceEntry> workExperience,
        List<EducationEntry>      education,
        String              remotePolicy,
        String              hybridOnsiteDays,
        String              availability,
        /** CV + profile skills used for ATS highlighting in job descriptions */
        String[]            atsKeywords,
        Integer             completenessScore,
        Long                version,
        String              jobDomain
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
        @jakarta.validation.constraints.NotBlank(message = "Title is required")
        @jakarta.validation.constraints.Size(max = 200, message = "Title too long")
        String       title,
        @jakarta.validation.constraints.Size(max = 500, message = "URL too long")
        String       url,
        @jakarta.validation.constraints.Size(max = 1000, message = "Description too long")
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
