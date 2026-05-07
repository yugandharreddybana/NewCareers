package com.careerops.service.sources;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Component
public class JobicySource implements JobSource {
    private static final Logger log = LoggerFactory.getLogger(JobicySource.class);
    private final WebClient client;
    public JobicySource(JobApiHttpClient httpClient) { this.client = httpClient.createClient("https://jobicy.com"); }

    @Override public String name() { return "jobicy"; }

    @Override
    public List<Job> fetch(UserProfile profile) {
        List<Job> out = new ArrayList<>();
        try {
            JsonNode root = client.get().uri("/api/v2/remote-jobs?count=30&industry=engineering")
                .retrieve().bodyToMono(JsonNode.class).block();
            if (root == null) return out;
            for (JsonNode r : root.path("jobs")) {
                Job j = Job.builder()
                    .title(r.path("jobTitle").asText())
                    .company(r.path("companyName").asText("Unknown"))
                    .location(r.path("jobGeo").asText("Remote"))
                    .description(r.path("jobExcerpt").asText())
                    .sourceUrl(r.path("url").asText())
                    .sourceName("Jobicy")
                    .currency("USD")
                    .postedAt(parseDate(r.path("pubDate").asText()))
                    .build();
                j.setFingerprint(FingerprintUtil.of(j.getCompany(), j.getTitle(), j.getLocation()));
                out.add(j);
            }
        } catch (Exception e) { log.warn("Jobicy fetch failed: {}", e.getMessage()); }
        return out;
    }

    private static Instant parseDate(String s) {
        try { return s == null || s.isBlank() ? Instant.now() : Instant.parse(s); }
        catch (Exception e) { return Instant.now(); }
    }
}
