package com.careerops.service.sources;

import com.careerops.dto.SearchParams;
import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Section 7 — Task 68
 * Google Jobs via SerpAPI.
 * API docs: https://serpapi.com/google-jobs-api
 *
 * Activation:
 *   - Set serpapi.api.key property to enable.
 *   - fetch() always returns empty (background scraping not supported).
 *   - search() performs live Google Jobs queries.
 */
@Component
public class SerpApiJobSource implements JobSource {

    private static final Logger log  = LoggerFactory.getLogger(SerpApiJobSource.class);
    private static final String BASE = "https://serpapi.com/search.json";

    private static final String DEFAULT_DATE_RANGE = "week";

    @Value("${serpapi.api.key:}")
    private String apiKey;

    private final WebClient webClient;

    public SerpApiJobSource() {
        // 3.023 — Disable redirects to prevent API key leak in Referer headers
        HttpClient httpClient = HttpClient.create().followRedirect(false);
        this.webClient = WebClient.builder()
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .baseUrl(BASE)
                .build();
    }

    @Override public String    name()              { return "SerpAPI (Google Jobs)"; }
    @Override public List<Job> fetch(UserProfile p) { return List.of(); }
    @Override public boolean   hasBudget()         { return apiKey != null && !apiKey.isBlank(); }

    @Override
    @SuppressWarnings("unchecked")
    public List<Job> search(SearchParams params, UserProfile profile) {
        if (!hasBudget()) return List.of();

        String query    = params.toSearchQuery();
        String location = (params.getLocation() != null
                           && !params.getLocation().isBlank()
                           && !"All Ireland".equalsIgnoreCase(params.getLocation()))
                          ? params.getLocation() : "Ireland";

        String dateRange = DEFAULT_DATE_RANGE;

        List<Job> results = new ArrayList<>();
        try {
            Map<String, Object> body = webClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .queryParam("engine",      "google_jobs")
                            .queryParam("q",           query)
                            .queryParam("location",    location)
                            .queryParam("hl",          "en")
                            .queryParam("gl",          "ie")
                            .queryParam("date_posted", dateRange)
                            .queryParam("num",         10)
                            .build())
                    .header("X-SerpAPI-Key", apiKey)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .timeout(java.time.Duration.ofSeconds(15))
                    .block();

            if (body == null) return List.of();

            List<Map<String, Object>> jobsData =
                    (List<Map<String, Object>>) body.getOrDefault("jobs_results", List.of());

            for (Map<String, Object> item : jobsData) {
                Job job = new Job();
                job.setId(UUID.randomUUID());
                job.setTitle(str(item, "title"));
                job.setCompany(str(item, "company_name"));
                job.setLocation(str(item, "location"));
                job.setDescription(str(item, "description"));
                job.setSourceName(name());
                job.setPostedAt(Instant.now());

                // Salary from detected_extensions
                Map<String, Object> ext =
                        (Map<String, Object>) item.getOrDefault("detected_extensions", Map.of());
                String salary = str(ext, "salary");
                if (!salary.isBlank()) {
                    job.setDescription(job.getDescription() + "\n\nSalary: " + salary);
                }

                // Apply link (first option wins)
                List<Map<String, Object>> applyOptions =
                        (List<Map<String, Object>>) item.getOrDefault("apply_options", List.of());
                if (!applyOptions.isEmpty()) {
                    job.setSourceUrl(str(applyOptions.get(0), "link"));
                }

                // Sponsorship heuristic
                String combined = (job.getTitle() + " " + job.getDescription()).toLowerCase();
                job.setSponsorship(
                    combined.contains("visa") ||
                    combined.contains("sponsorship") ||
                    combined.contains("work permit")
                );

                // Remote heuristic (3.046 — added null guard)
                if (job.getLocation() != null) {
                    String locL = job.getLocation().toLowerCase();
                    if (!locL.contains("remote") && combined.contains("remote")) {
                        job.setLocation(job.getLocation() + " (Remote)");
                    }
                }

                results.add(job);
            }
            log.info("SerpAPI returned {} jobs for '{}' (date_posted={})",
                     results.size(), query, dateRange);
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            if (e.getStatusCode().value() == 429) {
                String retryAfter = e.getResponseHeaders() != null ? e.getResponseHeaders().getFirst(org.springframework.http.HttpHeaders.RETRY_AFTER) : null;
                Integer seconds = null;
                if (retryAfter != null) {
                    try { seconds = Integer.parseInt(retryAfter); } catch (NumberFormatException nfe) { /* ignore */ }
                }
                throw com.careerops.exception.ApiException.tooManyRequests(
                    "Job search provider is currently overloaded. Please try again in a few seconds.", seconds);
            }
            log.warn("SerpAPI search failed for '{}' with status {}: {}", query, e.getStatusCode(), e.getResponseBodyAsString());
        } catch (Exception e) {
            log.warn("SerpAPI search failed for '{}': {}", query, e.getMessage());
        }
        return results;
    }

    private static String str(Map<String, Object> m, String key) {
        Object v = m == null ? null : m.get(key);
        return v instanceof String s ? s : "";
    }
}
