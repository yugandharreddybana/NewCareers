package com.careerops.service.sources;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Free Arbeitnow job-board API (no key) — EU-heavy remote/onsite listings.
 * Same aggregator-style volume boost as Careerjet without publisher signup.
 */
@Component
public class ArbeitnowSource implements JobSource {

    private static final Logger log = LoggerFactory.getLogger(ArbeitnowSource.class);
    private static final String URL = "https://www.arbeitnow.com/api/job-board-api";

    private final JobApiHttpClient http;
    private final ObjectMapper mapper;

    public ArbeitnowSource(JobApiHttpClient http, ObjectMapper mapper) {
        this.http = http;
        this.mapper = mapper;
    }

    @Override
    public String name() {
        return "Arbeitnow";
    }

    @Override
    public boolean hasBudget() {
        return true;
    }

    @Override
    public List<Job> fetch(UserProfile profile) {
        List<Job> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        try {
            String json = http.get(URL);
            if (json == null || json.isBlank()) return out;
            JsonNode root = mapper.readTree(json);
            JsonNode data = root.path("data");
            if (!data.isArray()) return out;

            Set<String> roleHints = roleHints(profile);
            for (JsonNode row : data) {
                if (out.size() >= 120) break;
                String title = row.path("title").asText("").trim();
                String url = row.path("url").asText("").trim();
                if (title.isBlank() || url.isBlank() || !seen.add(url)) continue;
                if (!roleHints.isEmpty() && !matchesHints(title, row.path("description").asText(""), roleHints)) {
                    continue;
                }
                String company = row.path("company_name").asText("Unknown");
                String location = row.path("location").asText("Remote");
                boolean remote = row.path("remote").asBoolean(false);
                if (remote && !location.toLowerCase(Locale.ROOT).contains("remote")) {
                    location = location.isBlank() ? "Remote" : location + " (Remote)";
                }
                Instant posted = Instant.now();
                long created = row.path("created_at").asLong(0);
                if (created > 0) {
                    // Arbeitnow returns unix seconds
                    posted = Instant.ofEpochSecond(created > 10_000_000_000L ? created / 1000 : created);
                }
                Job j = Job.builder()
                        .title(title)
                        .company(company)
                        .location(location)
                        .description(row.path("description").asText(""))
                        .sourceUrl(url)
                        .sourceName(name())
                        .currency("EUR")
                        .postedAt(posted)
                        .build();
                j.setFingerprint(FingerprintUtil.of(j.getCompany(), j.getTitle(), j.getLocation()));
                out.add(j);
            }
            log.info("Arbeitnow fetched {} jobs (filtered from {})", out.size(), data.size());
        } catch (Exception e) {
            log.warn("Arbeitnow fetch failed: {}", e.getMessage());
        }
        return out;
    }

    private static Set<String> roleHints(UserProfile profile) {
        Set<String> hints = new HashSet<>();
        if (profile == null || profile.getTargetRoles() == null) return hints;
        for (String role : profile.getTargetRoles()) {
            if (role == null || role.isBlank()) continue;
            for (String token : role.toLowerCase(Locale.ROOT).split("[^a-z0-9+#.]+")) {
                if (token.length() >= 3) hints.add(token);
            }
        }
        // Always keep engineering-ish volume if no roles
        return hints;
    }

    private static boolean matchesHints(String title, String description, Set<String> hints) {
        String hay = (title + " " + description).toLowerCase(Locale.ROOT);
        for (String h : hints) {
            if (hay.contains(h)) return true;
        }
        // Broad tech fallback so we still deliver volume for generic engineering profiles
        return hay.contains("software") || hay.contains("engineer") || hay.contains("developer")
                || hay.contains("fullstack") || hay.contains("full stack") || hay.contains("backend")
                || hay.contains("frontend") || hay.contains("java") || hay.contains("python")
                || hay.contains("react") || hay.contains("data");
    }
}
