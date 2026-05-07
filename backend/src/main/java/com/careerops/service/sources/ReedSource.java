package com.careerops.service.sources;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

@Component
public class ReedSource implements JobSource {
    private static final Logger log = LoggerFactory.getLogger(ReedSource.class);
    private final WebClient client;
    private final String key;

    public ReedSource(JobApiHttpClient httpClient, @Value("${reed.api.key}") String key) {
        this.client = httpClient.createClient("https://www.reed.co.uk/api/1.0");
        this.key = key;
    }

    @Override public String name() { return "reed"; }

    @Override
    public List<Job> fetch(UserProfile profile) {
        List<Job> out = new ArrayList<>();
        if (key == null || key.isBlank() || key.startsWith("YOUR_")) return out;
        String role = profile.getTargetRoles() == null || profile.getTargetRoles().length == 0
            ? "software engineer" : profile.getTargetRoles()[0];
        String basic = Base64.getEncoder().encodeToString((key + ":").getBytes(StandardCharsets.UTF_8));
        try {
            JsonNode root = client.get().uri(b -> b.path("/search")
                    .queryParam("keywords", role)
                    .queryParam("locationName", "Ireland")
                    .queryParam("resultsToTake", 30).build())
                .header("Authorization", "Basic " + basic)
                .retrieve().bodyToMono(JsonNode.class)
                .timeout(java.time.Duration.ofSeconds(15))
                .block();
            if (root == null) return out;
            for (JsonNode r : root.path("results")) {
                Job j = Job.builder()
                    .title(r.path("jobTitle").asText())
                    .company(r.path("employerName").asText("Unknown"))
                    .location(r.path("locationName").asText())
                    .salaryMin(r.path("minimumSalary").isNumber() ? r.path("minimumSalary").asInt() : null)
                    .salaryMax(r.path("maximumSalary").isNumber() ? r.path("maximumSalary").asInt() : null)
                    .description(r.path("jobDescription").asText())
                    .sourceUrl(r.path("jobUrl").asText())
                    .sourceName("Reed")
                    .currency("EUR")
                    .postedAt(parseDate(r.path("date").asText()))
                    .build();
                j.setFingerprint(FingerprintUtil.of(j.getCompany(), j.getTitle(), j.getLocation()));
                out.add(j);
            }
        } catch (Exception e) { log.warn("Reed fetch failed: {}", e.getMessage()); }
        return out;
    }

    private static Instant parseDate(String s) {
        try { return s == null || s.isBlank() ? Instant.now() : Instant.parse(s + "T00:00:00Z"); }
        catch (Exception e) { return Instant.now(); }
    }
}
