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

/**
 * Adzuna job source — Ireland.
 *
 * Iterates ALL target roles (up to 3) so the user gets matches across
 * their full target profile, not just the first role.
 * Falls back to "software engineer" if no roles are set.
 * Skips fetch silently if appId/appKey are blank.
 */
@Component
public class AdzunaSource implements JobSource {
    private static final Logger log = LoggerFactory.getLogger(AdzunaSource.class);

    private final WebClient client;
    private final String    appId;
    private final String    appKey;
    private final int       dailyLimit;
    private final AtomicInteger todayCalls = new AtomicInteger(0);

    private static final int MAX_ROLES = 3;

    public AdzunaSource(JobApiHttpClient httpClient,
                        @Value("${adzuna.app.id:}") String appId,
                        @Value("${adzuna.app.key:}") String appKey,
                        @Value("${adzuna.daily.limit:250}") int limit) {
        this.client     = httpClient.createClient("https://api.adzuna.com");
        this.appId      = appId;
        this.appKey     = appKey;
        this.dailyLimit = limit;
    }

    @Override public String  name()      { return "adzuna"; }
    @Override public boolean hasBudget() { return todayCalls.get() < dailyLimit; }

    @Override
    public List<Job> fetch(UserProfile profile) {
        List<Job> out = new ArrayList<>();
        if (appId == null || appId.isBlank()) return out;   // key not configured — skip silently
        if (!hasBudget()) return out;

        String[] roles = resolveRoles(profile);
        int maxDays = Math.max(1, (profile.getFreshnessHours() == null ? 96 : profile.getFreshnessHours()) / 24);

        for (int r = 0; r < Math.min(roles.length, MAX_ROLES) && hasBudget(); r++) {
            String role = roles[r];
            String url  = UriComponentsBuilder.fromUriString("/v1/api/jobs/ie/search/1")
                    .queryParam("app_id",         appId)
                    .queryParam("app_key",        appKey)
                    .queryParam("results_per_page", 30)
                    .queryParam("what",           role)
                    .queryParam("max_days_old",   maxDays)
                    .toUriString();
            try {
                JsonNode root = client.get().uri(url).retrieve().bodyToMono(JsonNode.class).block();
                todayCalls.incrementAndGet();
                if (root == null) continue;
                for (JsonNode r2 : root.path("results")) {
                    Job j = Job.builder()
                            .title(r2.path("title").asText())
                            .company(r2.path("company").path("display_name").asText("Unknown"))
                            .location(r2.path("location").path("display_name").asText())
                            .salaryMin(r2.path("salary_min").isNumber() ? r2.path("salary_min").asInt() : null)
                            .salaryMax(r2.path("salary_max").isNumber() ? r2.path("salary_max").asInt() : null)
                            .description(r2.path("description").asText())
                            .sourceUrl(r2.path("redirect_url").asText())
                            .sourceName("Adzuna")
                            .sector(r2.path("category").path("label").asText(null))
                            .currency("EUR")
                            .postedAt(parseDate(r2.path("created").asText()))
                            .build();
                    j.setFingerprint(FingerprintUtil.of(j.getCompany(), j.getTitle(), j.getLocation(), j.getSalaryMin(), j.getSalaryMax()));
                    out.add(j);
                }
                log.info("Adzuna fetched {} jobs for role '{}'", out.size(), role);
            } catch (Exception e) {
                log.warn("Adzuna fetch failed for role '{}': {}", role, e.getMessage());
            }
        }
        return out;
    }

    private static String[] resolveRoles(UserProfile p) {
        if (p.getTargetRoles() != null && p.getTargetRoles().length > 0) return p.getTargetRoles();
        return new String[]{"software engineer"};
    }

    private static Instant parseDate(String s) {
        try { return s == null || s.isBlank() ? Instant.now() : Instant.parse(s); }
        catch (Exception e) { return Instant.now(); }
    }
}
