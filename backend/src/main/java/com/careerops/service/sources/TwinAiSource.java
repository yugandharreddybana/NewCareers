package com.careerops.service.sources;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * Uses Twin AI browser-automation agent to fetch LinkedIn job listings.
 *
 * Twin AI (https://twin.so) runs a real browser session, searches LinkedIn Jobs,
 * and returns structured results — no direct scraping or LinkedIn auth needed.
 *
 * Set twin.api.key + twin.enabled=true in application.properties to activate.
 * Default: twin.enabled=false (zero cost until you opt in).
 */
@Component
public class TwinAiSource implements JobSource {
    private static final Logger log = LoggerFactory.getLogger(TwinAiSource.class);

    private final WebClient   client;
    private final String      apiKey;
    private final boolean     enabled;
    private final ObjectMapper mapper;

    public TwinAiSource(JobApiHttpClient httpClient,
                        @Value("${twin.api.key:}") String apiKey,
                        @Value("${twin.enabled:false}") boolean enabled,
                        ObjectMapper mapper) {
        this.apiKey  = apiKey;
        this.enabled = enabled && apiKey != null && !apiKey.isBlank() && !apiKey.startsWith("YOUR_");
        this.client  = httpClient.createClient("https://api.twin.so");
        this.mapper  = mapper;
    }

    @Override public String  name()      { return "twin-linkedin"; }
    @Override public boolean hasBudget() { return enabled; }

    @Override
    public List<Job> fetch(UserProfile profile) {
        List<Job> out = new ArrayList<>();
        if (!enabled) {
            log.info("Twin AI disabled – set twin.enabled=true and twin.api.key to activate LinkedIn jobs");
            return out;
        }

        String[] roles = (profile.getTargetRoles() == null || profile.getTargetRoles().length == 0)
            ? new String[]{"Full Stack Developer"}
            : profile.getTargetRoles();

        for (String role : Arrays.copyOf(roles, Math.min(roles.length, 2))) {
            try {
                Map<String, Object> body = Map.of(
                    "task",           buildTask(role, profile),
                    "output_format",  "json",
                    "timeout_seconds", 120
                );

                JsonNode response = client.post()
                    .uri("/v1/agent/run")
                    .header("Authorization", "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .block();

                if (response == null) continue;

                String outputRaw = response.path("output").asText("");
                if (outputRaw.isBlank()) continue;

                JsonNode parsed;
                try {
                    parsed = mapper.readTree(outputRaw);
                } catch (Exception ex) {
                    log.warn("Twin AI response not valid JSON for role '{}': {}", role,
                        outputRaw.substring(0, Math.min(200, outputRaw.length())));
                    continue;
                }

                JsonNode jobsArr = parsed.isArray() ? parsed : parsed.path("jobs");
                int before = out.size();
                for (JsonNode r : jobsArr) {
                    String title       = r.path("title").asText("").trim();
                    String company     = r.path("company").asText("Unknown").trim();
                    String location    = r.path("location").asText("Ireland").trim();
                    String url         = r.path("url").asText("").trim();
                    String description = r.path("description").asText("").trim();
                    String postedStr   = r.path("posted_at").asText("").trim();

                    if (title.isEmpty()) continue;

                    Job j = Job.builder()
                        .title(title).company(company).location(location)
                        .description(description.isEmpty() ? null : description)
                        .sourceUrl(url.isEmpty() ? "https://linkedin.com/jobs" : url)
                        .sourceName("LinkedIn (Twin AI)")
                        .currency("EUR")
                        .postedAt(parseDate(postedStr))
                        .build();
                    j.setFingerprint(FingerprintUtil.of(j.getCompany(), j.getTitle(), j.getLocation()));
                    out.add(j);
                    if (out.size() >= 30) break;
                }
                log.info("Twin AI (LinkedIn) returned {} jobs for role '{}'", out.size() - before, role);

            } catch (Exception e) {
                log.warn("Twin AI fetch failed for role '{}': {}", role, e.getMessage());
            }
        }
        return out;
    }

    private String buildTask(String role, UserProfile profile) {
        String location = profile.getLocation() != null ? profile.getLocation() : "Ireland";
        int hours = profile.getFreshnessHours() != null ? profile.getFreshnessHours() : 96;
        int days  = Math.max(1, hours / 24);
        return String.format("""
            Go to https://www.linkedin.com/jobs/search/ and search for \"%s\" jobs in \"%s\".
            Filter by: date posted = past %d day(s), job type = full-time.
            For each job listing visible on the first 2 pages, extract:
              - title       (string)
              - company     (string)
              - location    (string)
              - url         (string — full LinkedIn job URL)
              - description (string — first 500 chars of the job description)
              - posted_at   (string — ISO 8601 if available, otherwise empty string)
            Return ONLY a valid JSON array of these objects with no extra text.
            Limit to 25 results maximum.
            """, role, location, days);
    }

    private static Instant parseDate(String s) {
        if (s == null || s.isBlank()) return Instant.now();
        try { return Instant.parse(s); } catch (Exception e) { return Instant.now(); }
    }
}
