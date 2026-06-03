package com.careerops.service.sources.company;

import com.careerops.model.Job;
import com.careerops.service.sources.FingerprintUtil;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Deterministic Playwright scrape via the Python scraper sidecar (no LLM).
 */
@Component
public class PlaywrightCareerClient {

    private static final Logger log = LoggerFactory.getLogger(PlaywrightCareerClient.class);

    private final WebClient client;
    private final boolean enabled;

    public PlaywrightCareerClient(
            WebClient.Builder builder,
            @Value("${scraper.base-url:}") String baseUrl) {
        this.enabled = baseUrl != null && !baseUrl.isBlank();
        this.client = enabled ? builder.clone().baseUrl(baseUrl).build() : null;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public List<Job> fetch(String company, String url, int timeoutSeconds) {
        if (!enabled || client == null) {
            return List.of();
        }
        List<Job> out = new ArrayList<>();
        try {
            JsonNode body = client.post()
                .uri("/scrape/jobs/playwright")
                .bodyValue(new PlaywrightRequest(url, timeoutSeconds))
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block();
            if (body == null) {
                return out;
            }
            JsonNode jobs = body.path("result").path("jobs");
            if (!jobs.isArray()) {
                jobs = body.path("jobs");
            }
            for (JsonNode row : jobs) {
                String title = row.path("title").asText("").trim();
                if (title.length() < 4) {
                    continue;
                }
                String location = row.path("location").asText("Ireland").trim();
                String jobUrl = row.path("url").asText(url).trim();
                Job j = Job.builder()
                    .title(title)
                    .company(company)
                    .location(location.isBlank() ? "Ireland" : location)
                    .sourceUrl(jobUrl.isBlank() ? url : jobUrl)
                    .sourceName(AtsApiCompanyAdapter.SOURCE_NAME)
                    .currency("EUR")
                    .postedAt(Instant.now())
                    .build();
                j.setFingerprint(FingerprintUtil.of(j.getCompany(), j.getTitle(), j.getLocation()));
                out.add(j);
            }
        } catch (Exception e) {
            log.debug("Playwright scrape failed for {}: {}", company, e.getMessage());
        }
        return out;
    }

    private record PlaywrightRequest(String url, int timeout) {}
}
