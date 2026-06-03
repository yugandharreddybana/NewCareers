package com.careerops.service.sources.company;

import com.careerops.model.Job;
import com.careerops.service.sources.FingerprintUtil;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Fetches jobs from public ATS JSON APIs (Greenhouse, Lever, Ashby).
 */
@Component
public class AtsApiCompanyAdapter {

    private static final Logger log = LoggerFactory.getLogger(AtsApiCompanyAdapter.class);
    public static final String SOURCE_NAME = "jsoup-companies";

    private final WebClient greenhouse;
    private final WebClient lever;
    private final WebClient ashby;

    public AtsApiCompanyAdapter(org.springframework.web.reactive.function.client.WebClient.Builder builder) {
        this.greenhouse = builder.clone().baseUrl("https://boards-api.greenhouse.io").build();
        this.lever = builder.clone().baseUrl("https://api.lever.co").build();
        this.ashby = builder.clone().baseUrl("https://api.ashbyhq.com").build();
    }

    public List<Job> fetch(CompanyCareerRegistry.Entry entry) {
        if (entry.slug() == null || entry.slug().isBlank()) {
            return List.of();
        }
        return switch (effectiveStrategy(entry)) {
            case GREENHOUSE -> fetchGreenhouse(entry);
            case LEVER -> fetchLever(entry);
            case ASHBY -> fetchAshby(entry);
            default -> List.of();
        };
    }

    private static CompanyCareerRegistry.Strategy effectiveStrategy(CompanyCareerRegistry.Entry entry) {
        if (entry.strategy() == CompanyCareerRegistry.Strategy.AUTO) {
            return CompanyCareerRegistry.detectAutoStrategy(entry.url());
        }
        return entry.strategy();
    }

    private List<Job> fetchGreenhouse(CompanyCareerRegistry.Entry entry) {
        List<Job> out = new ArrayList<>();
        try {
            JsonNode root = greenhouse.get()
                .uri("/v1/boards/{slug}/jobs?content=true", entry.slug())
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block();
            if (root == null) {
                return out;
            }
            JsonNode jobs = root.isArray() ? root : root.path("jobs");
            for (JsonNode row : jobs) {
                String title = row.path("title").asText("").trim();
                if (title.isBlank()) {
                    continue;
                }
                String location = row.path("location").path("name").asText("Ireland").trim();
                if (!matchesIreland(location)) {
                    continue;
                }
                Job j = baseJob(entry.name(), title, location,
                    row.path("absolute_url").asText(entry.url()),
                    row.path("content").asText(null));
                out.add(j);
            }
        } catch (Exception e) {
            log.debug("Greenhouse fetch failed for {}: {}", entry.name(), e.getMessage());
        }
        return out;
    }

    private List<Job> fetchLever(CompanyCareerRegistry.Entry entry) {
        List<Job> out = new ArrayList<>();
        try {
            JsonNode root = lever.get()
                .uri("/v0/postings/{slug}", entry.slug())
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block();
            if (root == null || !root.isArray()) {
                return out;
            }
            for (JsonNode row : root) {
                String title = row.path("text").asText("").trim();
                if (title.isBlank()) {
                    continue;
                }
                String location = row.path("categories").path("location").asText("Ireland").trim();
                if (!matchesIreland(location)) {
                    continue;
                }
                Job j = baseJob(entry.name(), title, location,
                    row.path("hostedUrl").asText(entry.url()),
                    row.path("descriptionPlain").asText(null));
                out.add(j);
            }
        } catch (Exception e) {
            log.debug("Lever fetch failed for {}: {}", entry.name(), e.getMessage());
        }
        return out;
    }

    private List<Job> fetchAshby(CompanyCareerRegistry.Entry entry) {
        List<Job> out = new ArrayList<>();
        try {
            JsonNode root = ashby.get()
                .uri("/posting-api/job-board/{slug}?includeCompensation=true", entry.slug())
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block();
            if (root == null) {
                return out;
            }
            for (JsonNode row : root.path("jobs")) {
                String title = row.path("title").asText("").trim();
                if (title.isBlank()) {
                    continue;
                }
                String location = row.path("location").asText("Ireland").trim();
                if (!matchesIreland(location) && !row.path("isRemote").asBoolean(false)) {
                    continue;
                }
                Job j = baseJob(entry.name(), title, location,
                    row.path("jobUrl").asText(entry.url()),
                    row.path("descriptionPlain").asText(null));
                out.add(j);
            }
        } catch (Exception e) {
            log.debug("Ashby fetch failed for {}: {}", entry.name(), e.getMessage());
        }
        return out;
    }

    static boolean matchesIreland(String location) {
        if (location == null || location.isBlank()) {
            return true;
        }
        String lower = location.toLowerCase(Locale.ROOT);
        return lower.contains("ireland")
            || lower.contains("dublin")
            || lower.contains("cork")
            || lower.contains("galway")
            || lower.contains("limerick")
            || lower.contains("remote")
            || lower.contains("emea")
            || lower.contains("europe");
    }

    private static Job baseJob(String company, String title, String location, String url, String description) {
        Job j = Job.builder()
            .title(title)
            .company(company)
            .location(location.isBlank() ? "Ireland" : location)
            .sourceUrl(url)
            .sourceName(SOURCE_NAME)
            .currency("EUR")
            .postedAt(Instant.now())
            .description(description)
            .build();
        j.setFingerprint(FingerprintUtil.of(j.getCompany(), j.getTitle(), j.getLocation()));
        return j;
    }
}
