package com.careerops.config;

import com.careerops.model.CompanyReliabilityScore;
import com.careerops.model.CompanyYearHistory;
import com.careerops.model.PermitCompany;
import com.careerops.model.PermitCounty;
import com.careerops.model.PermitSector;
import com.careerops.model.PermitSnapshot;
import com.careerops.model.UserDomainMapping;
import com.careerops.repository.CompanyReliabilityScoreRepository;
import com.careerops.repository.CompanyYearHistoryRepository;
import com.careerops.repository.PermitCompanyRepository;
import com.careerops.repository.PermitCountyRepository;
import com.careerops.repository.PermitSectorRepository;
import com.careerops.repository.PermitSnapshotRepository;
import com.careerops.repository.UserDomainMappingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Seeds Irish permit analytics demo data for local {@code test} profile (H2)
 * when snapshots are missing — so the dashboard Permit Intelligence widget works
 * without running the full Python ingestion pipeline.
 */
@Component
@Profile("test")
@Order(50)
public class LocalPermitDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(LocalPermitDataSeeder.class);

    private static final Map<String, String> DOMAIN_SECTORS = Map.of(
            "TECH", "J",
            "HEALTHCARE", "Q",
            "FINANCE", "K",
            "CONSTRUCTION", "F",
            "EDUCATION", "P",
            "HOSPITALITY", "I",
            "PHARMA", "C",
            "AGRICULTURE", "A"
    );

    private static final Map<String, String> SECTOR_NAMES = Map.of(
            "J", "Information and communication",
            "Q", "Human health and social work activities",
            "K", "Financial and insurance activities",
            "F", "Construction",
            "P", "Education",
            "I", "Accommodation and food service activities",
            "C", "Manufacturing",
            "A", "Agriculture, forestry and fishing"
    );

    private final PermitSnapshotRepository snapshots;
    private final PermitSectorRepository sectors;
    private final PermitCompanyRepository companies;
    private final PermitCountyRepository counties;
    private final UserDomainMappingRepository domainMappings;
    private final CompanyReliabilityScoreRepository reliabilityScores;
    private final CompanyYearHistoryRepository yearHistory;

    public LocalPermitDataSeeder(
            PermitSnapshotRepository snapshots,
            PermitSectorRepository sectors,
            PermitCompanyRepository companies,
            PermitCountyRepository counties,
            UserDomainMappingRepository domainMappings,
            CompanyReliabilityScoreRepository reliabilityScores,
            CompanyYearHistoryRepository yearHistory) {
        this.snapshots = snapshots;
        this.sectors = sectors;
        this.companies = companies;
        this.counties = counties;
        this.domainMappings = domainMappings;
        this.reliabilityScores = reliabilityScores;
        this.yearHistory = yearHistory;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        seedDomainMappings();
        boolean missingYears = snapshots.findAllActiveYears().isEmpty()
                || snapshots.findFirstBySourceYearOrderByFetchedAtDesc(2026).isEmpty()
                || snapshots.findFirstBySourceYearOrderByFetchedAtDesc(2025).isEmpty();
        if (missingYears) {
            seedYear(2025, true);
            seedYear(2026, true);
            seedReliabilityAndHistory();
            log.info("LocalPermitDataSeeder: seeded permit snapshots for 2025–2026");
        } else {
            if (reliabilityScores.count() == 0) {
                seedReliabilityAndHistory();
            }
            log.debug("LocalPermitDataSeeder: active permit snapshots already present");
        }
    }

    private void seedDomainMappings() {
        DOMAIN_SECTORS.forEach((domain, code) -> {
            if (domainMappings.findByDomainKeyIgnoreCase(domain).isEmpty()) {
                domainMappings.save(UserDomainMapping.builder()
                        .domainKey(domain)
                        .sectorCode(code)
                        .build());
            }
        });
    }

    private void seedYear(int year, boolean active) {
        if (snapshots.findFirstBySourceYearOrderByFetchedAtDesc(year).isPresent()) {
            return;
        }
        PermitSnapshot snap = snapshots.save(PermitSnapshot.builder()
                .sourceYear(year)
                .fullYear(year < Instant.now().atZone(java.time.ZoneOffset.UTC).getYear())
                .active(active)
                .fetchedAt(Instant.now())
                .sourceUrl("local-seed://enterprise.gov.ie/" + year)
                .rowCountCompanies(6)
                .rowCountSectors(SECTOR_NAMES.size())
                .rowCountCounties(4)
                .build());

        Long sid = snap.getId();
        SECTOR_NAMES.forEach((code, name) -> {
            int total = switch (code) {
                case "J" -> year == 2026 ? 18420 : 17110;
                case "Q" -> year == 2026 ? 9200 : 8800;
                case "K" -> year == 2026 ? 6100 : 5900;
                case "C" -> year == 2026 ? 5400 : 5100;
                default -> 2000 + code.charAt(0);
            };
            sectors.save(PermitSector.builder()
                    .snapshotId(sid)
                    .sourceYear(year)
                    .sectorCode(code)
                    .sectorName(name)
                    .permitsJan(total / 12)
                    .permitsFeb(total / 12)
                    .permitsMar(total / 12)
                    .permitsApr(total / 12)
                    .grandTotal(total)
                    .build());
        });

        List<String[]> sponsors = List.of(
                new String[]{"Google Ireland Limited", "google ireland limited", "UP"},
                new String[]{"Microsoft Ireland Operations Ltd", "microsoft ireland operations ltd", "STABLE"},
                new String[]{"Meta Platforms Ireland Ltd", "meta platforms ireland ltd", "UP"},
                new String[]{"Amazon Web Services Ireland", "amazon web services ireland", "STABLE"},
                new String[]{"Accenture", "accenture", "DOWN"},
                new String[]{"IBM Ireland Ltd", "ibm ireland ltd", "STABLE"}
        );
        int rank = 1;
        for (String[] row : sponsors) {
            int total = 900 - rank * 80 + (year == 2026 ? 40 : 0);
            companies.save(PermitCompany.builder()
                    .snapshotId(sid)
                    .sourceYear(year)
                    .employerName(row[0])
                    .employerNameNormalised(row[1])
                    .permitsJan(total / 12)
                    .permitsFeb(total / 12)
                    .permitsMar(total / 12)
                    .permitsApr(total / 12)
                    .grandTotal(total)
                    .status("ACTIVE")
                    .momentum(row[2])
                    .rankOverall(rank)
                    .rankInSector(rank)
                    .build());
            rank++;
        }

        counties.save(PermitCounty.builder()
                .snapshotId(sid).sourceYear(year).county("Dublin").issued(12000).refused(1800).build());
        counties.save(PermitCounty.builder()
                .snapshotId(sid).sourceYear(year).county("Cork").issued(2100).refused(320).build());
        counties.save(PermitCounty.builder()
                .snapshotId(sid).sourceYear(year).county("Galway").issued(980).refused(140).build());
        counties.save(PermitCounty.builder()
                .snapshotId(sid).sourceYear(year).county("Limerick").issued(720).refused(95).build());
    }

    private void seedReliabilityAndHistory() {
        List<Object[]> rows = List.of(
                new Object[]{"google ireland limited", "Google Ireland Limited", "98.50", "ELITE", 4200},
                new Object[]{"microsoft ireland operations ltd", "Microsoft Ireland Operations Ltd", "96.20", "ELITE", 3800},
                new Object[]{"meta platforms ireland ltd", "Meta Platforms Ireland Ltd", "94.10", "STRONG", 3100},
                new Object[]{"amazon web services ireland", "Amazon Web Services Ireland", "91.80", "STRONG", 2900},
                new Object[]{"accenture", "Accenture", "78.40", "CONSISTENT", 2100},
                new Object[]{"ibm ireland ltd", "IBM Ireland Ltd", "82.60", "STRONG", 1800}
        );
        for (int i = 0; i < rows.size(); i++) {
            Object[] row = rows.get(i);
            final int rank = i + 1;
            String norm = (String) row[0];
            String name = (String) row[1];
            if (reliabilityScores.findByEmployerNameNormalised(norm).isEmpty()) {
                reliabilityScores.save(CompanyReliabilityScore.builder()
                        .employerNameNormalised(norm)
                        .canonicalName(name)
                        .firstSeenYear(2022)
                        .lastSeenYear(2026)
                        .yearsActive(5)
                        .totalYearsInDataset(5)
                        .reliabilityScore(new BigDecimal((String) row[2]))
                        .reliabilityTier((String) row[3])
                        .totalPermitsAllTime((Integer) row[4])
                        .peakYear(2026)
                        .peakYearTotal(900 - rank * 40)
                        .avgAnnualPermits(new BigDecimal("600.00"))
                        .trend3yr("UP")
                        .yoyChangePct(new BigDecimal("4.50"))
                        .sectorCode("J")
                        .build());
            }
            List<CompanyYearHistory> existing = yearHistory
                    .findByEmployerNameNormalisedOrderBySourceYearAsc(norm);
            for (int y = 2022; y <= 2026; y++) {
                final int year = y;
                boolean hasYear = existing.stream().anyMatch(h -> h.getSourceYear() == year);
                if (!hasYear) {
                    yearHistory.save(CompanyYearHistory.builder()
                            .employerNameNormalised(norm)
                            .sourceYear(year)
                            .grandTotal(700 - rank * 50 + (year - 2022) * 30)
                            .rankThatYear(rank)
                            .build());
                }
            }
        }
    }
}
