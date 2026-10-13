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
public class RemotiveSource implements JobSource {
    private static final Logger log = LoggerFactory.getLogger(RemotiveSource.class);
    private final WebClient client;
    public RemotiveSource(JobApiHttpClient httpClient) { this.client = httpClient.createClient("https://remotive.com"); }

    @Override public String name() { return "remotive"; }

    @Override
    public List<Job> fetch(UserProfile profile) {
        List<Job> out = new ArrayList<>();
        java.util.LinkedHashSet<String> queries = new java.util.LinkedHashSet<>();
        if (profile.getTargetRoles() != null) {
            for (String role : profile.getTargetRoles()) {
                if (role != null && !role.isBlank()) {
                    queries.add(role.trim());
                }
            }
        }
        if (queries.isEmpty()) {
            queries.add("software");
        }
        // Broaden haul for engineering profiles
        queries.add("software engineer");
        queries.add("full stack");
        java.util.HashSet<String> seen = new java.util.HashSet<>();
        for (String role : queries) {
            if (out.size() >= 90) break;
            try {
                JsonNode root = client.get().uri(b -> b.path("/api/remote-jobs")
                        .queryParam("search", role).queryParam("limit", 50).build())
                    .retrieve().bodyToMono(JsonNode.class).block();
                if (root == null) continue;
                for (JsonNode r : root.path("jobs")) {
                    String url = r.path("url").asText("");
                    String fpKey = url.isBlank()
                        ? r.path("title").asText() + "|" + r.path("company_name").asText()
                        : url;
                    if (!seen.add(fpKey)) continue;
                    Job j = Job.builder()
                        .title(r.path("title").asText())
                        .company(r.path("company_name").asText("Unknown"))
                        .location(r.path("candidate_required_location").asText("Remote"))
                        .description(r.path("description").asText())
                        .sourceUrl(url)
                        .sourceName("Remotive")
                        .sector(r.path("category").asText(null))
                        .currency("USD")
                        .postedAt(parseDate(r.path("publication_date").asText()))
                        .build();
                    j.setFingerprint(FingerprintUtil.of(j.getCompany(), j.getTitle(), j.getLocation()));
                    out.add(j);
                }
            } catch (Exception e) {
                log.warn("Remotive fetch failed for '{}': {}", role, e.getMessage());
            }
        }
        return out;
    }

    private static Instant parseDate(String s) {
        try { return s == null || s.isBlank() ? Instant.now() : Instant.parse(s); }
        catch (Exception e) { return Instant.now(); }
    }
}
