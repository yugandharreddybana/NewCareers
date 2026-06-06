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
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

/**
 * Reed.co.uk job board adapter.
 *
 * Batch-2 improvements:
 *  - Uses shared JobApiHttpClient (pooled OkHttpClient) with Basic auth header
 *  - URL built with UriComponentsBuilder for safe encoding
 *  - ObjectMapper is injected (Spring-managed)
 */
@Component
public class ReedSource implements JobSource {

    private static final Logger log = LoggerFactory.getLogger(ReedSource.class);
    private static final String REED_API = "https://www.reed.co.uk/api/1.0/search";

    private final JobApiHttpClient httpClient;
    private final ObjectMapper     mapper;

    @Value("${reed.api.key:}")
    private String apiKey;

    @Autowired
    public ReedSource(JobApiHttpClient httpClient, ObjectMapper mapper) {
        this.httpClient = httpClient;
        this.mapper     = mapper;
    }

    @Override public String name() { return "Reed"; }
    @Override public boolean isEnabled()  { return apiKey != null && !apiKey.isBlank(); }

    @Override
    public List<JobListing> fetch(String keyword, String location, int maxAgeDays) {
        List<JobListing> results = new ArrayList<>();
        if (!isEnabled()) return results;

        try {
            String url = UriComponentsBuilder.fromHttpUrl(REED_API)
                    .queryParam("keywords",       keyword)
                    .queryParam("locationName",   location.isBlank() ? "" : location)
                    .queryParam("resultsToTake",  50)
                    .build().toUriString();

            // Reed uses HTTP Basic auth: apiKey as username, empty password
            String basicAuth = "Basic " + Base64.getEncoder()
                    .encodeToString((apiKey + ":").getBytes());

            String json = httpClient.getWithHeader(url, "Authorization", basicAuth);
            if (json.isBlank()) return results;

            JsonNode root = mapper.readTree(json);
            JsonNode jobs = root.path("results");

            for (JsonNode job : jobs) {
                try {
                    String  title    = job.path("jobTitle").asText();
                    String  company  = job.path("employerName").asText();
                    String  loc      = job.path("locationName").asText();
                    String  link     = job.path("jobUrl").asText();
                    String  dateStr  = job.path("date").asText();
                    Instant posted   = null;
                    if (!dateStr.isBlank()) {
                        try { posted = Instant.parse(dateStr); } catch (Exception ignored) {}
                    }

                    JobListing j = new JobListing();
                    j.setTitle(title);   j.setCompany(company); j.setLocation(loc);
                    j.setUrl(link);      j.setSource(name()); j.setPostedAt(posted);
                    results.add(j);
                } catch (Exception e) {
                    log.debug("Reed item parse error", e);
                }
            }
            log.debug("Reed: fetched {} jobs", results.size());
        } catch (Exception e) {
            log.warn("Reed fetch failed: {}", e.getMessage());
        }
        return results;
    }
}
