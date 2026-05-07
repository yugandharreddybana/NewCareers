package com.careerops.service.sources;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class AdzunaSource implements JobSource {
    private static final Logger log = LoggerFactory.getLogger(AdzunaSource.class);

    private final WebClient client;
    private final String appId;
    private final String appKey;
    private final int dailyLimit;
    private final AtomicInteger todayCalls = new AtomicInteger(0);

    public AdzunaSource(JobApiHttpClient httpClient,
                        @Value("${adzuna.app.id}") String appId,
                        @Value("${adzuna.app.key}") String appKey,
                        @Value("${adzuna.daily.limit:250}") int limit) {
        this.client = httpClient.createClient("https://api.adzuna.com");
        this.appId = appId; this.appKey = appKey; this.dailyLimit = limit;
    }

    @Override public String name() { return "adzuna"; }
    @Override public boolean hasBudget() { return todayCalls.get() < dailyLimit; }

    @Override
    public List<Job> fetch(UserProfile profile) {
        List<Job> out = new ArrayList<>();
        if (appId == null || appId.isBlank() || appId.startsWith("YOUR_")) return out;
        if (!hasBudget()) return out;
        String role = profile.getTargetRoles() == null || profile.getTargetRoles().length == 0
            ? "software engineer" : profile.getTargetRoles()[0];
        String url = UriComponentsBuilder.fromUriString("/v1/api/jobs/ie/search/1")
            .queryParam("app_id", appId).queryParam("app_key", appKey)
            .queryParam("results_per_page", 30)
            .queryParam("what", role)
            .queryParam("max_days_old", Math.max(1, (profile.getFreshnessHours() == null ? 96 : profile.getFreshnessHours()) / 24))
            .toUriString();
        try {
            JsonNode root = client.get().uri(url).retrieve().bodyToMono(JsonNode.class).block();
            todayCalls.incrementAndGet();
            if (root == null) return out;
            for (JsonNode r : root.path("results")) {
                Job j = Job.builder()
                    .title(r.path("title").asText())
                    .company(r.path("company").path("display_name").asText("Unknown"))
                    .location(r.path("location").path("display_name").asText())
                    .salaryMin(r.path("salary_min").isNumber() ? r.path("salary_min").asInt() : null)
                    .salaryMax(r.path("salary_max").isNumber() ? r.path("salary_max").asInt() : null)
                    .description(r.path("description").asText())
                    .sourceUrl(r.path("redirect_url").asText())
                    .sourceName("Adzuna")
                    .sector(r.path("category").path("label").asText(null))
                    .currency("EUR")
                    .postedAt(parseDate(r.path("created").asText()))
                    .build();
                j.setFingerprint(FingerprintUtil.of(j.getCompany(), j.getTitle(), j.getLocation(), j.getSalaryMin(), j.getSalaryMax()));
                out.add(j);
            }
        } catch (Exception e) { log.warn("Adzuna fetch failed: {}", e.getMessage()); }
        return out;
    }

    private static Instant parseDate(String s) {
        try { return s == null || s.isBlank() ? Instant.now() : Instant.parse(s); }
        catch (Exception e) { return Instant.now(); }
    }
}
