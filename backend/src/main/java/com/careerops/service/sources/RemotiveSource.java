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
    public RemotiveSource(WebClient.Builder b) { this.client = b.baseUrl("https://remotive.com").build(); }

    @Override public String name() { return "remotive"; }

    @Override
    public List<Job> fetch(UserProfile profile) {
        List<Job> out = new ArrayList<>();
        String role = profile.getTargetRoles() == null || profile.getTargetRoles().length == 0
            ? "software" : profile.getTargetRoles()[0];
        try {
            JsonNode root = client.get().uri(b -> b.path("/api/remote-jobs")
                    .queryParam("search", role).queryParam("limit", 30).build())
                .retrieve().bodyToMono(JsonNode.class).block();
            if (root == null) return out;
            for (JsonNode r : root.path("jobs")) {
                Job j = Job.builder()
                    .title(r.path("title").asText())
                    .company(r.path("company_name").asText("Unknown"))
                    .location(r.path("candidate_required_location").asText("Remote"))
                    .description(r.path("description").asText())
                    .sourceUrl(r.path("url").asText())
                    .sourceName("Remotive")
                    .sector(r.path("category").asText(null))
                    .currency("USD")
                    .postedAt(parseDate(r.path("publication_date").asText()))
                    .build();
                j.setFingerprint(FingerprintUtil.of(j.getCompany(), j.getTitle(), j.getLocation()));
                out.add(j);
            }
        } catch (Exception e) { log.warn("Remotive fetch failed: {}", e.getMessage()); }
        return out;
    }

    private static Instant parseDate(String s) {
        try { return s == null || s.isBlank() ? Instant.now() : Instant.parse(s); }
        catch (Exception e) { return Instant.now(); }
    }
}
