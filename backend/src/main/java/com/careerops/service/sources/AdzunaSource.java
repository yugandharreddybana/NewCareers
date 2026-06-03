package com.careerops.service.sources;

import com.careerops.model.JobListing;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

@Component
public class AdzunaSource implements JobSource {

    private static final Logger log = LoggerFactory.getLogger(AdzunaSource.class);
    private final ObjectMapper mapper = new ObjectMapper();
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${adzuna.app-id:}")
    private String appId;
    @Value("${adzuna.app-key:}")
    private String appKey;

    @Override public String sourceName() { return "Adzuna"; }
    @Override public boolean isEnabled() { return appId != null && !appId.isBlank(); }

    @Override
    public List<JobListing> fetch(String keyword, String location, int maxAgeDays) {
        List<JobListing> results = new ArrayList<>();
        if (!isEnabled()) return results;
        try {
            String maxDaysParam = maxAgeDays > 0 ? "&max_days_old=" + maxAgeDays : "";
            String url = "https://api.adzuna.com/v1/api/jobs/ie/search/1?app_id=" + appId
                    + "&app_key=" + appKey
                    + "&results_per_page=50"
                    + "&what=" + keyword.replace(" ", "%20")
                    + "&where=" + (location.isBlank() ? "ireland" : location.replace(" ", "%20"))
                    + "&sort_by=date" + maxDaysParam;
            String json = restTemplate.getForObject(url, String.class);
            if (json == null) return results;
            JsonNode root = mapper.readTree(json);
            JsonNode jobs = root.path("results");
            Instant cutoff = maxAgeDays > 0 ? Instant.now().minus(maxAgeDays, ChronoUnit.DAYS) : null;
            for (JsonNode job : jobs) {
                try {
                    String title   = job.path("title").asText();
                    String company = job.path("company").path("display_name").asText();
                    String loc     = job.path("location").path("display_name").asText();
                    String link    = job.path("redirect_url").asText();
                    String created = job.path("created").asText();
                    Instant posted = null;
                    if (!created.isBlank()) {
                        try { posted = Instant.parse(created); } catch (Exception ignored) {}
                    }
                    if (cutoff != null && posted != null && posted.isBefore(cutoff)) continue;
                    JobListing j = new JobListing();
                    j.setTitle(title); j.setCompany(company); j.setLocation(loc);
                    j.setUrl(link); j.setSource(sourceName()); j.setPostedAt(posted);
                    results.add(j);
                } catch (Exception e) { log.debug("Adzuna item parse", e); }
            }
        } catch (Exception e) { log.warn("Adzuna fetch failed: {}", e.getMessage()); }
        return results;
    }
}
