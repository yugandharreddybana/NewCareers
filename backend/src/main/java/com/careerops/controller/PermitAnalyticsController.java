package com.careerops.controller;

import com.careerops.dto.PagedResponse;
import com.careerops.dto.PermitAnalyticsDtos.*;
import com.careerops.service.PermitAnalyticsService;
import com.careerops.util.AuthUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/**
 * Employment permit analytics (enterprise.gov.ie, 2009–2026).
 *
 * Servlet context path {@code /api} applies — middleware exposes {@code /api/v1/analytics/permits/*}.
 *
 * CORS Policy:
 * - Allowed Origins: from ${cors.allowed.origins}
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Internal-Secret, X-Internal-User-Id
 * - Exposed: X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 */
@RestController
@RequestMapping("/analytics/permits")
@RequiredArgsConstructor
@io.micrometer.core.annotation.Timed
@Tag(name = "Permit Analytics", description = "Irish employment permit statistics and sponsor intelligence")
public class PermitAnalyticsController {

    private final PermitAnalyticsService permitAnalyticsService;

    // ─── Public ───────────────────────────────────────────────────────────────

    @GetMapping("/summary")
    @Operation(summary = "Latest-year permit summary for dashboards")
    public PermitSummaryDto summary() {
        return permitAnalyticsService.getSummary();
    }

    @GetMapping("/companies")
    @Operation(summary = "Paginated company search with optional reliability filters")
    public PagedResponse<PermitCompanyDto> companies(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) String momentum,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String tier,
            @RequestParam(required = false) BigDecimal minReliability,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return permitAnalyticsService.searchCompanies(
                q, year, momentum, status, tier, minReliability, page, size);
    }

    @GetMapping("/companies/{normalisedName}/profile")
    @Operation(summary = "Full company profile for detail drawer/modal")
    public CompanyProfileDto companyProfile(@PathVariable String normalisedName) {
        return permitAnalyticsService.getCompanyProfile(normalisedName);
    }

    @GetMapping("/companies/{normalisedName}/history")
    @Operation(summary = "Year-by-year permit history for sparkline charts")
    public List<YearDataPoint> companyHistory(@PathVariable String normalisedName) {
        return permitAnalyticsService.getCompanyHistory(normalisedName);
    }

    @GetMapping("/sectors")
    @Operation(summary = "Sector breakdown for a given year")
    public List<PermitSectorDto> sectors(@RequestParam(required = false) Integer year) {
        return permitAnalyticsService.getSectors(year);
    }

    @GetMapping("/sectors/trend")
    @Operation(summary = "Multi-year sector trend series")
    public List<SectorTrendDto> sectorTrend(
            @RequestParam(defaultValue = "2009") int from,
            @RequestParam(defaultValue = "2026") int to,
            @RequestParam(required = false) String codes) {
        List<String> codeList = codes == null || codes.isBlank()
                ? List.of()
                : Arrays.stream(codes.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .toList();
        return permitAnalyticsService.getSectorTrend(from, to, codeList);
    }

    @GetMapping("/counties")
    @Operation(summary = "County issued/refused breakdown")
    public List<PermitCountyDto> counties(@RequestParam(required = false) Integer year) {
        return permitAnalyticsService.getCounties(year);
    }

    @GetMapping("/market/trend")
    @Operation(summary = "Macro permit trend by year")
    public List<MarketTrendDto> marketTrend(
            @RequestParam(defaultValue = "2009") int from,
            @RequestParam(defaultValue = "2026") int to) {
        return permitAnalyticsService.getMarketTrend(from, to);
    }

    @GetMapping("/reliability/top")
    @Operation(summary = "Top employers by cross-year reliability score")
    public PagedResponse<CompanyReliabilityDto> topReliability(
            @RequestParam(required = false) String tier,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return permitAnalyticsService.getTopReliability(tier, page, size);
    }

    // ─── Authenticated ────────────────────────────────────────────────────────

    @GetMapping("/domain/{domainKey}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Career-domain dashboard (sector-filtered)")
    public DomainDashboardDto domainDashboard(
            @PathVariable String domainKey,
            @RequestParam(required = false) Integer year) {
        return permitAnalyticsService.getDomainDashboard(domainKey, year);
    }

    @GetMapping("/watchlist")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "User permit employer watchlist")
    public List<WatchlistItemDto> watchlist() {
        return permitAnalyticsService.getWatchlist(AuthUtil.currentUserId());
    }

    @PostMapping("/watchlist/{normalisedName}")
    @PreAuthorize("isAuthenticated()")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Add employer to permit watchlist")
    public ResponseEntity<Void> addWatchlist(@PathVariable String normalisedName) {
        permitAnalyticsService.addToWatchlist(AuthUtil.currentUserId(), normalisedName);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @DeleteMapping("/watchlist/{normalisedName}")
    @PreAuthorize("isAuthenticated()")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Remove employer from permit watchlist")
    public void removeWatchlist(@PathVariable String normalisedName) {
        permitAnalyticsService.removeFromWatchlist(AuthUtil.currentUserId(), normalisedName);
    }
}
