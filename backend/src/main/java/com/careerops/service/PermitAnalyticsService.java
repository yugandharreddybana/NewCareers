package com.careerops.service;

import com.careerops.dto.PagedResponse;
import com.careerops.dto.PermitAnalyticsDtos.*;
import com.careerops.exception.ResourceNotFoundException;
import com.careerops.exception.ValidationException;
import com.careerops.model.*;
import com.careerops.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PermitAnalyticsService {

    private final PermitSnapshotRepository snapshotRepository;
    private final PermitCompanyRepository companyRepository;
    private final PermitSectorRepository sectorRepository;
    private final PermitCountyRepository countyRepository;
    private final CompanyReliabilityScoreRepository reliabilityRepository;
    private final CompanyYearHistoryRepository yearHistoryRepository;
    private final UserDomainMappingRepository domainMappingRepository;
    private final UserPermitWatchlistRepository watchlistRepository;

    public PermitSummaryDto getSummary() {
        int year = resolveLatestYear(null);
        PermitSnapshot snapshot = requireActiveSnapshot(year);
        Long snapshotId = snapshot.getId();

        List<PermitSectorDto> topSectors = sectorRepository
                .findAllBySnapshotIdOrderByGrandTotalDesc(snapshotId)
                .stream()
                .limit(5)
                .map(this::toSectorDto)
                .toList();

        List<PermitCountyDto> topCounties = countyRepository
                .findAllBySnapshotIdOrderByIssuedDesc(snapshotId)
                .stream()
                .limit(10)
                .map(this::toCountyDto)
                .toList();

        List<PermitCompanyDto> topSponsors = companyRepository
                .findBySnapshotIdOrderByGrandTotalDesc(snapshotId, PageRequest.of(0, 20))
                .map(this::toCompanyDto)
                .getContent();

        return new PermitSummaryDto(
                topSectors,
                topCounties,
                topSponsors,
                companyRepository.countActiveInSnapshot(snapshotId),
                sectorRepository.sumGrandTotal(snapshotId),
                snapshot.getFetchedAt(),
                snapshotRepository.findAllActiveYears()
        );
    }

    public PagedResponse<PermitCompanyDto> searchCompanies(
            String q,
            Integer year,
            String momentum,
            String status,
            String tier,
            BigDecimal minReliability,
            int page,
            int size) {
        int resolvedYear = resolveLatestYear(year);
        PermitSnapshot snapshot = requireActiveSnapshot(resolvedYear);
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "grandTotal"));

        boolean hasFilters = momentum != null || status != null || tier != null || minReliability != null;
        Page<PermitCompany> result;
        if (hasFilters) {
            result = companyRepository.searchWithFilters(
                    snapshot.getId(),
                    blankToNull(q),
                    momentum,
                    status,
                    tier,
                    minReliability,
                    pageable);
        } else if (q != null && !q.isBlank()) {
            result = companyRepository.searchByName(blankToNull(q), snapshot.getId(), pageable);
        } else {
            result = companyRepository.findBySnapshotIdOrderByGrandTotalDesc(snapshot.getId(), pageable);
        }

        return PagedResponse.of(result.map(this::toCompanyDto));
    }

    public CompanyProfileDto getCompanyProfile(String normalisedName) {
        String key = requireNormalisedKey(normalisedName);
        int year = resolveLatestYear(null);
        PermitCompany current = companyRepository
                .findByEmployerNameNormalisedAndSourceYear(key, year)
                .orElseThrow(() -> new ResourceNotFoundException("Company", key));

        CompanyReliabilityDto reliability = reliabilityRepository
                .findByEmployerNameNormalised(key)
                .map(this::toReliabilityDtoWithHistory)
                .orElse(null);

        List<YearDataPoint> history = yearHistoryRepository
                .findByEmployerNameNormalisedOrderBySourceYearAsc(key)
                .stream()
                .map(h -> new YearDataPoint(h.getSourceYear(), h.getGrandTotal(), h.getRankThatYear()))
                .toList();

        return new CompanyProfileDto(toCompanyDto(current), reliability, history);
    }

    public List<YearDataPoint> getCompanyHistory(String normalisedName) {
        String key = requireNormalisedKey(normalisedName);
        return yearHistoryRepository.findByEmployerNameNormalisedOrderBySourceYearAsc(key)
                .stream()
                .map(h -> new YearDataPoint(h.getSourceYear(), h.getGrandTotal(), h.getRankThatYear()))
                .toList();
    }

    public List<PermitSectorDto> getSectors(Integer year) {
        PermitSnapshot snapshot = requireActiveSnapshot(resolveLatestYear(year));
        return sectorRepository.findAllBySnapshotIdOrderByGrandTotalDesc(snapshot.getId())
                .stream()
                .map(this::toSectorDto)
                .toList();
    }

    public List<SectorTrendDto> getSectorTrend(int from, int to, List<String> codes) {
        validateYearRange(from, to);
        List<String> sectorCodes = codes == null || codes.isEmpty()
                ? List.of("J", "Q", "K")
                : codes.stream().map(String::toUpperCase).toList();

        Map<String, String> sectorNames = new LinkedHashMap<>();
        Map<String, List<SectorTrendPoint>> pointsByCode = new LinkedHashMap<>();

        for (int y = from; y <= to; y++) {
            Optional<PermitSnapshot> snap = snapshotRepository.findActiveByYear(y);
            if (snap.isEmpty()) {
                continue;
            }
            List<PermitSector> sectors = sectorRepository.findByCodesAndSnapshot(
                    sectorCodes, snap.get().getId());
            for (PermitSector sector : sectors) {
                sectorNames.putIfAbsent(sector.getSectorCode(), sector.getSectorName());
                pointsByCode
                        .computeIfAbsent(sector.getSectorCode(), k -> new ArrayList<>())
                        .add(new SectorTrendPoint(y, sector.getGrandTotal()));
            }
        }

        return sectorCodes.stream()
                .map(code -> new SectorTrendDto(
                        code,
                        sectorNames.getOrDefault(code, code),
                        pointsByCode.getOrDefault(code, List.of())))
                .toList();
    }

    public List<PermitCountyDto> getCounties(Integer year) {
        PermitSnapshot snapshot = requireActiveSnapshot(resolveLatestYear(year));
        return countyRepository.findAllBySnapshotIdOrderByIssuedDesc(snapshot.getId())
                .stream()
                .map(this::toCountyDto)
                .toList();
    }

    public List<MarketTrendDto> getMarketTrend(int from, int to) {
        validateYearRange(from, to);
        List<MarketTrendDto> trends = new ArrayList<>();
        for (int y = from; y <= to; y++) {
            Optional<PermitSnapshot> snap = snapshotRepository.findActiveByYear(y);
            if (snap.isEmpty()) {
                continue;
            }
            Long snapshotId = snap.get().getId();
            String topSector = sectorRepository.findFirstBySnapshotIdOrderByGrandTotalDesc(snapshotId)
                    .map(PermitSector::getSectorName)
                    .orElse(null);
            String topCounty = countyRepository.findFirstBySnapshotIdOrderByIssuedDesc(snapshotId)
                    .map(PermitCounty::getCounty)
                    .orElse(null);
            trends.add(new MarketTrendDto(
                    y,
                    sectorRepository.sumGrandTotal(snapshotId),
                    topSector,
                    topCounty));
        }
        return trends;
    }

    public PagedResponse<CompanyReliabilityDto> getTopReliability(String tier, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<CompanyReliabilityScore> scores = reliabilityRepository.findTopScorers(
                blankToNull(tier), pageable);
        return PagedResponse.of(scores.map(this::toReliabilityDtoWithHistory));
    }

    public DomainDashboardDto getDomainDashboard(String domainKey, Integer year) {
        String key = domainKey == null ? null : domainKey.trim().toUpperCase();
        if (key == null || key.isBlank()) {
            throw new ValidationException("domainKey is required");
        }

        List<UserDomainMapping> mappings = domainMappingRepository.findByDomainKeyIgnoreCase(key);
        if (mappings.isEmpty()) {
            throw new ResourceNotFoundException("Domain mapping", key);
        }

        List<String> codes = mappings.stream()
                .map(UserDomainMapping::getSectorCode)
                .distinct()
                .toList();

        int resolvedYear = resolveLatestYear(year);
        PermitSnapshot snapshot = requireActiveSnapshot(resolvedYear);
        List<PermitSector> sectors = sectorRepository.findByCodesAndSnapshot(codes, snapshot.getId());

        String sectorName = sectors.isEmpty()
                ? key
                : sectors.get(0).getSectorName();

        List<PermitCompanyDto> topCompanies = companyRepository
                .findBySnapshotIdOrderByGrandTotalDesc(snapshot.getId(), PageRequest.of(0, 20))
                .map(this::toCompanyDto)
                .getContent();

        List<PermitCountyDto> counties = countyRepository
                .findAllBySnapshotIdOrderByIssuedDesc(snapshot.getId())
                .stream()
                .limit(10)
                .map(this::toCountyDto)
                .toList();

        return new DomainDashboardDto(
                key,
                sectorName,
                sectors.stream().map(this::toSectorDto).toList(),
                topCompanies,
                counties,
                snapshot.getFetchedAt());
    }

    public List<WatchlistItemDto> getWatchlist(UUID userId) {
        int year = resolveLatestYear(null);
        PermitSnapshot snapshot = requireActiveSnapshot(year);

        return watchlistRepository.findByUserIdOrderByAddedAtDesc(userId).stream()
                .map(item -> {
                    PermitCompanyDto company = companyRepository
                            .findByEmployerNameNormalisedAndSnapshotId(
                                    item.getEmployerNameNormalised(), snapshot.getId())
                            .stream()
                            .findFirst()
                            .map(this::toCompanyDto)
                            .orElseGet(() -> reliabilityRepository
                                    .findByEmployerNameNormalised(item.getEmployerNameNormalised())
                                    .map(s -> toCompanyDtoFromReliability(
                                            s, year, snapshot.getId()))
                                    .orElseThrow(() -> new ResourceNotFoundException(
                                            "Watchlist company", item.getEmployerNameNormalised())));
                    return new WatchlistItemDto(item.getId(), item.getAddedAt(), company);
                })
                .toList();
    }

    @Transactional
    public void addToWatchlist(UUID userId, String normalisedName) {
        String key = requireNormalisedKey(normalisedName);
        if (!reliabilityRepository.findByEmployerNameNormalised(key).isPresent()
                && companyRepository.findByEmployerNameNormalisedAndSourceYear(
                        key, resolveLatestYear(null)).isEmpty()) {
            throw new ResourceNotFoundException("Company", key);
        }
        if (watchlistRepository.existsByUserIdAndEmployerNameNormalised(userId, key)) {
            throw new ValidationException("Company already on watchlist");
        }
        watchlistRepository.save(UserPermitWatchlist.builder()
                .userId(userId)
                .employerNameNormalised(key)
                .build());
    }

    @Transactional
    public void removeFromWatchlist(UUID userId, String normalisedName) {
        String key = requireNormalisedKey(normalisedName);
        if (!watchlistRepository.existsByUserIdAndEmployerNameNormalised(userId, key)) {
            throw new ResourceNotFoundException("Watchlist entry", key);
        }
        watchlistRepository.deleteByUserIdAndEmployerNameNormalised(userId, key);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private PermitSnapshot requireActiveSnapshot(int year) {
        return snapshotRepository.findActiveByYear(year)
                .orElseThrow(() -> new ResourceNotFoundException("Permit snapshot for year", year));
    }

    private int resolveLatestYear(Integer year) {
        if (year != null) {
            return year;
        }
        return snapshotRepository.findAllActiveYears().stream()
                .max(Integer::compareTo)
                .orElseThrow(() -> new ResourceNotFoundException("No active permit snapshots"));
    }

    private static void validateYearRange(int from, int to) {
        if (from > to) {
            throw new ValidationException("from year must be <= to year");
        }
    }

    private static String requireNormalisedKey(String normalisedName) {
        if (normalisedName == null || normalisedName.isBlank()) {
            throw new ValidationException("normalisedName is required");
        }
        return normalisedName.trim().toLowerCase();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private PermitCompanyDto toCompanyDto(PermitCompany pc) {
        Optional<CompanyReliabilityScore> crs = reliabilityRepository
                .findByEmployerNameNormalised(pc.getEmployerNameNormalised());
        return new PermitCompanyDto(
                pc.getId(),
                pc.getSnapshotId(),
                pc.getSourceYear(),
                pc.getEmployerName(),
                pc.getEmployerNameNormalised(),
                pc.getPermitsJan(),
                pc.getPermitsFeb(),
                pc.getPermitsMar(),
                pc.getPermitsApr(),
                pc.getPermitsMay(),
                pc.getPermitsJun(),
                pc.getPermitsJul(),
                pc.getPermitsAug(),
                pc.getPermitsSep(),
                pc.getPermitsOct(),
                pc.getPermitsNov(),
                pc.getPermitsDec(),
                pc.getGrandTotal(),
                pc.getStatus(),
                pc.getMomentum(),
                pc.getRankOverall(),
                pc.getRankInSector(),
                crs.map(CompanyReliabilityScore::getReliabilityScore).orElse(null),
                crs.map(CompanyReliabilityScore::getReliabilityTier).orElse(null),
                crs.map(CompanyReliabilityScore::getYearsActive).orElse(null)
        );
    }

    private PermitCompanyDto toCompanyDtoFromReliability(
            CompanyReliabilityScore score,
            int year,
            Long snapshotId) {
        return new PermitCompanyDto(
                null,
                snapshotId,
                year,
                score.getCanonicalName(),
                score.getEmployerNameNormalised(),
                null, null, null, null, null, null,
                null, null, null, null, null, null,
                score.getTotalPermitsAllTime(),
                "ACTIVE",
                null,
                null,
                null,
                score.getReliabilityScore(),
                score.getReliabilityTier(),
                score.getYearsActive()
        );
    }

    private PermitSectorDto toSectorDto(PermitSector s) {
        return new PermitSectorDto(
                s.getId(),
                s.getSnapshotId(),
                s.getSourceYear(),
                s.getSectorCode(),
                s.getSectorName(),
                s.getPermitsJan(),
                s.getPermitsFeb(),
                s.getPermitsMar(),
                s.getPermitsApr(),
                s.getPermitsMay(),
                s.getPermitsJun(),
                s.getPermitsJul(),
                s.getPermitsAug(),
                s.getPermitsSep(),
                s.getPermitsOct(),
                s.getPermitsNov(),
                s.getPermitsDec(),
                s.getGrandTotal()
        );
    }

    private PermitCountyDto toCountyDto(PermitCounty c) {
        int issued = c.getIssued();
        int refused = c.getRefused();
        int denom = issued + refused;
        BigDecimal rate = denom > 0
                ? BigDecimal.valueOf(issued * 100.0 / denom).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        return new PermitCountyDto(
                c.getId(),
                c.getSnapshotId(),
                c.getSourceYear(),
                c.getCounty(),
                issued,
                refused,
                rate
        );
    }

    private CompanyReliabilityDto toReliabilityDtoWithHistory(CompanyReliabilityScore score) {
        List<YearDataPoint> history = yearHistoryRepository
                .findByEmployerNameNormalisedOrderBySourceYearAsc(score.getEmployerNameNormalised())
                .stream()
                .map(h -> new YearDataPoint(h.getSourceYear(), h.getGrandTotal(), h.getRankThatYear()))
                .toList();
        return new CompanyReliabilityDto(
                score.getId(),
                score.getEmployerNameNormalised(),
                score.getCanonicalName(),
                score.getFirstSeenYear(),
                score.getLastSeenYear(),
                score.getYearsActive(),
                score.getTotalYearsInDataset(),
                score.getReliabilityScore(),
                score.getReliabilityTier(),
                score.getTotalPermitsAllTime(),
                score.getPeakYear(),
                score.getPeakYearTotal(),
                score.getAvgAnnualPermits(),
                score.getTrend3yr(),
                score.getYoyChangePct(),
                score.getSectorCode(),
                score.getUpdatedAt(),
                history
        );
    }
}
