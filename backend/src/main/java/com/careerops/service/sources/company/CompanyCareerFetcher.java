package com.careerops.service.sources.company;

import com.careerops.model.Job;
import com.careerops.service.sources.JsoupCompanySource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Tiered fetch for a single company: ATS API → Playwright → Jsoup.
 */
@Component
public class CompanyCareerFetcher {

    private static final Logger log = LoggerFactory.getLogger(CompanyCareerFetcher.class);

    private final AtsApiCompanyAdapter ats;
    private final PlaywrightCareerClient playwright;
    private final JsoupCompanySource jsoup;

    @Value("${company.careers.playwright-timeout-seconds:45}")
    private int playwrightTimeoutSeconds;

    public CompanyCareerFetcher(
            AtsApiCompanyAdapter ats,
            PlaywrightCareerClient playwright,
            JsoupCompanySource jsoup) {
        this.ats = ats;
        this.playwright = playwright;
        this.jsoup = jsoup;
    }

    public FetchResult fetchCompany(CompanyCareerRegistry.Entry entry) {
        long start = System.currentTimeMillis();
        CompanyCareerRegistry.Strategy strategy = resolveStrategy(entry);

        if (strategy == CompanyCareerRegistry.Strategy.JSOUP) {
            List<Job> jobs = jsoup.scrapeCompanyPage(entry.name(), entry.url());
            return result(entry.name(), "jsoup", jobs, start);
        }

        if (isAts(strategy)) {
            List<Job> jobs = ats.fetch(entry);
            if (!jobs.isEmpty()) {
                return result(entry.name(), "ats-" + strategy.name().toLowerCase(), jobs, start);
            }
        }

        if (strategy == CompanyCareerRegistry.Strategy.PLAYWRIGHT
            || strategy == CompanyCareerRegistry.Strategy.AUTO
            || isAts(strategy)) {
            if (playwright.isEnabled()) {
                List<Job> jobs = playwright.fetch(entry.name(), entry.url(), playwrightTimeoutSeconds);
                if (!jobs.isEmpty()) {
                    return result(entry.name(), "playwright", jobs, start);
                }
            }
        }

        List<Job> jobs = jsoup.scrapeCompanyPage(entry.name(), entry.url());
        return result(entry.name(), "jsoup", jobs, start);
    }

    private static FetchResult result(String company, String strategy, List<Job> jobs, long startMs) {
        long duration = System.currentTimeMillis() - startMs;
        log.info("company fetch company={} strategy={} jobsFound={} durationMs={}",
            company, strategy, jobs.size(), duration);
        return new FetchResult(company, strategy, jobs, duration);
    }

    private static CompanyCareerRegistry.Strategy resolveStrategy(CompanyCareerRegistry.Entry entry) {
        if (entry.strategy() != CompanyCareerRegistry.Strategy.AUTO) {
            return entry.strategy();
        }
        return CompanyCareerRegistry.detectAutoStrategy(entry.url());
    }

    private static boolean isAts(CompanyCareerRegistry.Strategy strategy) {
        return strategy == CompanyCareerRegistry.Strategy.GREENHOUSE
            || strategy == CompanyCareerRegistry.Strategy.LEVER
            || strategy == CompanyCareerRegistry.Strategy.ASHBY;
    }

    public record FetchResult(String company, String strategy, List<Job> jobs, long durationMs) {}
}
