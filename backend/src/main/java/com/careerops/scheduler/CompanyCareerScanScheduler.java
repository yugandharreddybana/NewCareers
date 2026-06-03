package com.careerops.scheduler;

import com.careerops.service.sources.company.CompanyCareerSource;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Background scan of all company career pages; keeps the jobs cache warm for fast user fetches.
 */
@Component
public class CompanyCareerScanScheduler {

    private static final Logger log = LoggerFactory.getLogger(CompanyCareerScanScheduler.class);

    private final CompanyCareerSource companyCareers;

    @Value("${company.careers.background-scan.enabled:true}")
    private boolean enabled;

    public CompanyCareerScanScheduler(CompanyCareerSource companyCareers) {
        this.companyCareers = companyCareers;
    }

    @Scheduled(cron = "${company.careers.scan-cron:0 0 */6 * * *}", zone = "Europe/Dublin")
    @SchedulerLock(name = "companyCareerBackgroundScan", lockAtMostFor = "3h", lockAtLeastFor = "10m")
    public void scanAllCompanies() {
        if (!enabled) {
            log.debug("Company career background scan disabled");
            return;
        }
        log.info("Starting scheduled company career scan");
        try {
            companyCareers.scanAllCompanies();
        } catch (Exception e) {
            log.warn("Scheduled company career scan failed: {}", e.getMessage());
        }
    }
}
