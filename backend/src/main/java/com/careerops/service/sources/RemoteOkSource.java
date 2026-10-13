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
 * Free RemoteOK public API (no key) — remote tech jobs feed.
 */
@Component
public class RemoteOkSource implements JobSource {

    private static final Logger log = LoggerFactory.getLogger(RemoteOkSource.class);
    private static final String URL = "https://remoteok.com/api";

    private final JobApiHttpClient http;
    private final ObjectMapper mapper;

    public RemoteOkSource(JobApiHttpClient http, ObjectMapper mapper) {
        this.http = http;
        this.mapper = mapper;
    }

    @Override
    public String name() {
        return "RemoteOK";
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
            String json = http.get(URL, "Mozilla/5.0 (compatible; CareerOps/2.0; +https://localhost)");
            if (json == null || json.isBlank()) return out;
            JsonNode root = mapper.readTree(json);
            if (!root.isArray()) return out;

            Set<String> hints = roleHints(profile);
            for (JsonNode row : root) {
                if (out.size() >= 100) break;
                // First element is often legal/meta without a position
                String title = row.path("position").asText("").trim();
                if (title.isBlank()) title = row.path("title").asText("").trim();
                String url = row.path("url").asText("").trim();
                if (url.isBlank()) {
                    String id = row.path("id").asText("");
                    if (!id.isBlank()) url = "https://remoteok.com/remote-jobs/" + id;
                }
                if (title.isBlank() || url.isBlank() || !seen.add(url)) continue;
                if (!hints.isEmpty() && !matches(title, row.path("description").asText(""), hints)) {
                    continue;
                }
                String company = row.path("company").asText("Unknown");
                String location = row.path("location").asText("Remote");
                if (location.isBlank()) location = "Remote";
                Instant posted = Instant.now();
                long epoch = row.path("epoch").asLong(0);
                if (epoch > 0) posted = Instant.ofEpochSecond(epoch);
                Job j = Job.builder()
                        .title(title)
                        .company(company)
                        .location(location)
                        .description(row.path("description").asText(""))
                        .sourceUrl(url)
                        .sourceName(name())
                        .currency("USD")
                        .salaryMin(intOrNull(row.path("salary_min")))
                        .salaryMax(intOrNull(row.path("salary_max")))
                        .postedAt(posted)
                        .build();
                j.setFingerprint(FingerprintUtil.of(j.getCompany(), j.getTitle(), j.getLocation()));
                out.add(j);
            }
            log.info("RemoteOK fetched {} jobs", out.size());
        } catch (Exception e) {
            log.warn("RemoteOK fetch failed: {}", e.getMessage());
        }
        return out;
    }

    private static Integer intOrNull(JsonNode n) {
        if (n == null || n.isMissingNode() || n.isNull() || !n.isNumber()) return null;
        int v = n.asInt();
        return v > 0 ? v : null;
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
        return hints;
    }

    private static boolean matches(String title, String description, Set<String> hints) {
        String hay = (title + " " + description).toLowerCase(Locale.ROOT);
        for (String h : hints) {
            if (hay.contains(h)) return true;
        }
        return hay.contains("software") || hay.contains("engineer") || hay.contains("developer")
                || hay.contains("full stack") || hay.contains("backend") || hay.contains("frontend");
    }
}
