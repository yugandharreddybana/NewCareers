package com.careerops.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * DTOs for employment permit analytics API ({@code /analytics/permits}).
 */
public final class PermitAnalyticsDtos {

    private PermitAnalyticsDtos() {}

    public record YearDataPoint(int year, int grandTotal, Integer rankThatYear) {}

    public record PermitCompanyDto(
            Long id,
            Long snapshotId,
            int sourceYear,
            String employerName,
            String employerNameNormalised,
            Integer permitsJan,
            Integer permitsFeb,
            Integer permitsMar,
            Integer permitsApr,
            Integer permitsMay,
            Integer permitsJun,
            Integer permitsJul,
            Integer permitsAug,
            Integer permitsSep,
            Integer permitsOct,
            Integer permitsNov,
            Integer permitsDec,
            int grandTotal,
            String status,
            String momentum,
            Integer rankOverall,
            Integer rankInSector,
            BigDecimal reliabilityScore,
            String reliabilityTier,
            Integer yearsActive
    ) {}

    public record PermitSectorDto(
            Long id,
            Long snapshotId,
            int sourceYear,
            String sectorCode,
            String sectorName,
            Integer permitsJan,
            Integer permitsFeb,
            Integer permitsMar,
            Integer permitsApr,
            Integer permitsMay,
            Integer permitsJun,
            Integer permitsJul,
            Integer permitsAug,
            Integer permitsSep,
            Integer permitsOct,
            Integer permitsNov,
            Integer permitsDec,
            int grandTotal
    ) {}

    public record PermitCountyDto(
            Long id,
            Long snapshotId,
            int sourceYear,
            String county,
            int issued,
            int refused,
            BigDecimal approvalRatePct
    ) {}

    public record PermitSummaryDto(
            List<PermitSectorDto> topSectors,
            List<PermitCountyDto> topCounties,
            List<PermitCompanyDto> topSponsors,
            long activeCompanyCount,
            long totalPermits,
            Instant lastRefreshed,
            List<Integer> yearsAvailable
    ) {}

    public record CompanyReliabilityDto(
            Long id,
            String employerNameNormalised,
            String canonicalName,
            int firstSeenYear,
            int lastSeenYear,
            int yearsActive,
            int totalYearsInDataset,
            BigDecimal reliabilityScore,
            String reliabilityTier,
            int totalPermitsAllTime,
            Integer peakYear,
            Integer peakYearTotal,
            BigDecimal avgAnnualPermits,
            String trend3yr,
            BigDecimal yoyChangePct,
            String sectorCode,
            Instant updatedAt,
            List<YearDataPoint> yearHistory
    ) {}

    public record CompanyProfileDto(
            PermitCompanyDto currentYear,
            CompanyReliabilityDto reliability,
            List<YearDataPoint> yearHistory
    ) {}

    public record DomainDashboardDto(
            String domainKey,
            String sectorName,
            List<PermitSectorDto> sectors,
            List<PermitCompanyDto> topCompanies,
            List<PermitCountyDto> counties,
            Instant snapshotDate
    ) {}

    public record WatchlistItemDto(
            Long watchlistId,
            Instant addedAt,
            PermitCompanyDto company
    ) {}

    public record MarketTrendDto(
            int year,
            long totalPermits,
            String topSector,
            String topCounty
    ) {}

    public record SectorTrendPoint(int year, int grandTotal) {}

    public record SectorTrendDto(
            String sectorCode,
            String sectorName,
            List<SectorTrendPoint> dataPoints
    ) {}
}
