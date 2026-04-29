package com.careerops.dto;

public class ProfileDtos {
    public record ProfileRequest(
        String[] targetRoles,
        String[] techStack,
        String location,
        Integer salaryMin,
        Integer salaryMax,
        String[] sectors,
        Integer freshnessHours,
        Integer minMatchPercent,
        Boolean sponsorshipRequired,
        Boolean onboarded
    ) {}

    public record ProfileResponse(
        String[] targetRoles, String[] techStack, String location,
        Integer salaryMin, Integer salaryMax, String[] sectors,
        Integer freshnessHours, Integer minMatchPercent,
        Boolean sponsorshipRequired, Boolean onboarded,
        String activeCvFileName
    ) {}

    public record StatsResponse(
        long total, long applied, long interviews, long offers, double avgMatch
    ) {}
}
