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
        // Jobicy accepts industry=engineering (and similar); invalid industries return 400.
        java.util.LinkedHashSet<String> industries = new java.util.LinkedHashSet<>();
        industries.add("engineering");
        industries.add("dev");
        if (profile.getTargetRoles() != null) {
            for (String role : profile.getTargetRoles()) {
                if (role == null || role.isBlank()) continue;
                String lower = role.toLowerCase(java.util.Locale.ROOT);
                if (lower.contains("data")) industries.add("data-science");
                if (lower.contains("design")) industries.add("design-multimedia");
                if (lower.contains("product")) industries.add("product");
            }
        }
        java.util.HashSet<String> seen = new java.util.HashSet<>();
        // Always pull a broad unfiltered page first for volume
        fetchJobicyPage(client, null, seen, out);
        for (String industry : industries) {
            if (out.size() >= 80) break;
            fetchJobicyPage(client, industry, seen, out);
        }
        return out;
    }

    private void fetchJobicyPage(WebClient client, String industry,
                                 java.util.Set<String> seen, List<Job> out) {
        try {
            JsonNode root = client.get()
                .uri(b -> {
                    var ub = b.path("/api/v2/remote-jobs").queryParam("count", 50);
                    if (industry != null && !industry.isBlank()) {
                        ub = ub.queryParam("industry", industry);
                    }
                    return ub.build();
                })
                .retrieve().bodyToMono(JsonNode.class).block();
            if (root == null) return;
            for (JsonNode r : root.path("jobs")) {
                if (out.size() >= 80) return;
                String url = r.path("url").asText("");
                String key = url.isBlank()
                    ? r.path("jobTitle").asText() + "|" + r.path("companyName").asText()
                    : url;
                if (!seen.add(key)) continue;
                Job j = Job.builder()
                    .title(r.path("jobTitle").asText())
                    .company(r.path("companyName").asText("Unknown"))
                    .location(r.path("jobGeo").asText("Remote"))
                    .description(r.path("jobExcerpt").asText())
                    .sourceUrl(url)
                    .sourceName("Jobicy")
                    .currency("USD")
                    .postedAt(parseDate(r.path("pubDate").asText()))
                    .build();
                j.setFingerprint(FingerprintUtil.of(j.getCompany(), j.getTitle(), j.getLocation()));
                out.add(j);
            }
        } catch (Exception e) {
            log.warn("Jobicy fetch failed for industry={}: {}", industry, e.getMessage());
        }
    }

    private static Instant parseDate(String s) {
        try { return s == null || s.isBlank() ? Instant.now() : Instant.parse(s); }
        catch (Exception e) { return Instant.now(); }
    }
}
