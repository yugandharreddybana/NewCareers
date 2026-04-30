package com.careerops.service.sources;

import com.careerops.dto.SearchParams;
import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

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
 *   - Set SERP_API_KEY env var to enable.
 *   - fetch() always returns empty (background scraping not supported).
 *   - search() performs live Google Jobs queries.
 *
 * Search params forwarded:
 *   - query    — from SearchParams.toSearchQuery()
 *   - location — from SearchParams.getLocation() → defaults to "Ireland"
 *   - date_range — defaults to "week" (7-day window). Falls back to "month"
 *                  if SearchParams has no date constraint.
 *
 * Response parsing:
 *   - jobs_results[] → Job entities
 *   - detected_extensions.salary → appended to description
 *   - apply_options[0].link → sourceUrl
 *   - Sponsorship / remote detected via title+description keyword heuristic
 */
@Component
public class SerpApiJobSource implements JobSource {

    private static final Logger log  = LoggerFactory.getLogger(SerpApiJobSource.class);
    private static final String BASE = "https://serpapi.com/search.json";

    /**
     * Default date window for job freshness.
     * SerpAPI Google Jobs accepts: today | 3days | week | month
     */
    private static final String DEFAULT_DATE_RANGE = "week";

    @Value("${SERP_API_KEY:}")
    private String apiKey;

    private final RestTemplate http = new RestTemplate();

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

        // ── Task 68: date-range parameter ─────────────────────────────────
        // SerpAPI Google Jobs uses "date_posted" param:
        // today | 3days | week | month
        // We default to "week" to match IndeedRSS fromage=7 window.
        String dateRange = DEFAULT_DATE_RANGE;

        String url = UriComponentsBuilder.fromHttpUrl(BASE)
                .queryParam("engine",      "google_jobs")
                .queryParam("q",           query)
                .queryParam("location",    location)
                .queryParam("hl",          "en")
                .queryParam("gl",          "ie")
                .queryParam("date_posted", dateRange)
                .queryParam("num",         10)
                .queryParam("api_key",     apiKey)
                .toUriString();

        List<Job> results = new ArrayList<>();
        try {
            Map<String, Object> body = http.getForObject(url, Map.class);
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

                // Remote heuristic
                String locL = job.getLocation().toLowerCase();
                if (!locL.contains("remote") && combined.contains("remote")) {
                    job.setLocation(job.getLocation() + " (Remote)");
                }

                results.add(job);
            }
            log.info("SerpAPI returned {} jobs for '{}' (date_posted={})",
                     results.size(), query, dateRange);
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
