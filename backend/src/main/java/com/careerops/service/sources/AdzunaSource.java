package com.careerops.service.sources;

import com.careerops.model.JobListing;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * Adzuna job board adapter.
 *
 * Batch-2 improvements:
 *  - Uses shared JobApiHttpClient (pooled OkHttpClient) instead of new RestTemplate()
 *  - URL built with UriComponentsBuilder for safe encoding
 *  - ObjectMapper is injected (Spring-managed, not per-class)
 */
@Component
public class AdzunaSource implements JobSource {

    private static final Logger log = LoggerFactory.getLogger(AdzunaSource.class);

    private final JobApiHttpClient httpClient;
    private final ObjectMapper     mapper;

    @Value("${adzuna.app.id:}")
    private String appId;

    @Value("${adzuna.app.key:}")
    private String appKey;

    @Value("${adzuna.country.code:gb}")
    private String countryCode;

    @Autowired
    public AdzunaSource(JobApiHttpClient httpClient, ObjectMapper mapper) {
        this.httpClient = httpClient;
        this.mapper     = mapper;
    }

    @Override public String sourceName() { return "Adzuna"; }
    @Override public boolean isEnabled()  { return appId != null && !appId.isBlank(); }

    @Override
    public List<JobListing> fetch(String keyword, String location, int maxAgeDays) {
        List<JobListing> results = new ArrayList<>();
        if (!isEnabled()) return results;

        try {
            UriComponentsBuilder uriBuilder = UriComponentsBuilder
                    .fromHttpUrl("https://api.adzuna.com/v1/api/jobs/{country}/search/1")
                    .queryParam("app_id",          appId)
                    .queryParam("app_key",         appKey)
                    .queryParam("results_per_page", 50)
                    .queryParam("what",             keyword)
                    .queryParam("where",            location.isBlank() ? "ireland" : location)
                    .queryParam("sort_by",          "date");
            if (maxAgeDays > 0) {
                uriBuilder.queryParam("max_days_old", maxAgeDays);
            }
            String url = uriBuilder.buildAndExpand(countryCode).toUriString();

            String json = httpClient.get(url);
            if (json.isBlank()) return results;

            JsonNode root = mapper.readTree(json);
            JsonNode jobs = root.path("results");
            Instant cutoff = maxAgeDays > 0 ? Instant.now().minus(maxAgeDays, ChronoUnit.DAYS) : null;

            for (JsonNode job : jobs) {
                try {
                    String  title   = job.path("title").asText();
                    String  company = job.path("company").path("display_name").asText();
                    String  loc     = job.path("location").path("display_name").asText();
                    String  link    = job.path("redirect_url").asText();
                    String  created = job.path("created").asText();
                    Instant posted  = null;
                    if (!created.isBlank()) {
                        try { posted = Instant.parse(created); } catch (Exception ignored) {}
                    }
                    if (cutoff != null && posted != null && posted.isBefore(cutoff)) continue;

                    JobListing j = new JobListing();
                    j.setTitle(title);   j.setCompany(company); j.setLocation(loc);
                    j.setUrl(link);      j.setSource(sourceName()); j.setPostedAt(posted);
                    results.add(j);
                } catch (Exception e) {
                    log.debug("Adzuna item parse error", e);
                }
            }
            log.debug("Adzuna: fetched {} jobs", results.size());
        } catch (Exception e) {
            log.warn("Adzuna fetch failed: {}", e.getMessage());
        }
        return results;
    }
}
