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
public class TheMuseSource implements JobSource {
    private static final Logger log = LoggerFactory.getLogger(TheMuseSource.class);
    private final WebClient client;
    public TheMuseSource(WebClient.Builder b) { this.client = b.baseUrl("https://www.themuse.com").build(); }

    @Override public String name() { return "themuse"; }

    @Override
    public List<Job> fetch(UserProfile profile) {
        List<Job> out = new ArrayList<>();
        try {
            JsonNode root = client.get().uri(b -> b.path("/api/public/jobs")
                    .queryParam("page", 0)
                    .queryParam("category", "Engineering").build())
                .retrieve().bodyToMono(JsonNode.class).block();
            if (root == null) return out;
            for (JsonNode r : root.path("results")) {
                String company = r.path("company").path("name").asText("Unknown");
                String loc = r.path("locations").isArray() && r.path("locations").size() > 0
                    ? r.path("locations").get(0).path("name").asText() : "Various";
                Job j = Job.builder()
                    .title(r.path("name").asText())
                    .company(company).location(loc)
                    .description(r.path("contents").asText())
                    .sourceUrl(r.path("refs").path("landing_page").asText())
                    .sourceName("TheMuse")
                    .currency("USD")
                    .postedAt(parseDate(r.path("publication_date").asText()))
                    .build();
                j.setFingerprint(FingerprintUtil.of(j.getCompany(), j.getTitle(), j.getLocation()));
                out.add(j);
            }
        } catch (Exception e) { log.warn("TheMuse fetch failed: {}", e.getMessage()); }
        return out;
    }

    private static Instant parseDate(String s) {
        try { return s == null || s.isBlank() ? Instant.now() : Instant.parse(s); }
        catch (Exception e) { return Instant.now(); }
    }
}
