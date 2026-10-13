package com.careerops.service.sources;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.careerops.service.JobProfileSearchTerms;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Careerjet publisher API (v4) — free job aggregator used by careerjet.com.
 *
 * How Careerjet works: they crawl/index boards + employer sites, then expose
 * search via a free publisher API. Monetisation is click-share, not a paid quota.
 *
 * Setup (free): https://www.careerjet.com/partners → register site → API key
 * (and whitelist your server IP). Set {@code CAREERJET_API_KEY}.
 *
 * Without a key this source is disabled ({@link #hasBudget()} = false).
 */
@Component
public class CareerjetSource implements JobSource {

    private static final Logger log = LoggerFactory.getLogger(CareerjetSource.class);
    private static final String ENDPOINT = "https://search.api.careerjet.net/v4/query";
    private static final String DEFAULT_UA =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 CareerOps/1.0";

    private final JobApiHttpClient http;
    private final ObjectMapper mapper;

    @Value("${careerjet.api.key:}")
    private String apiKey;

    @Value("${careerjet.locale:en_IE}")
    private String localeCode;

    @Value("${careerjet.referer:http://localhost:5173/jobs}")
    private String referer;

    @Value("${careerjet.user-ip:127.0.0.1}")
    private String userIp;

    public CareerjetSource(JobApiHttpClient http, ObjectMapper mapper) {
        this.http = http;
        this.mapper = mapper;
    }

    @Override
    public String name() {
        return "Careerjet";
    }

    @Override
    public boolean hasBudget() {
        return apiKey != null && !apiKey.isBlank();
    }

    @Override
    public List<Job> fetch(UserProfile profile) {
        List<Job> out = new ArrayList<>();
        if (!hasBudget()) {
            return out;
        }
        String location = profile.getLocation() == null || profile.getLocation().isBlank()
                ? "Ireland"
                : profile.getLocation();
        Set<String> seen = new HashSet<>();
        String auth = "Basic " + Base64.getEncoder()
                .encodeToString((apiKey.trim() + ":").getBytes(StandardCharsets.UTF_8));
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("Authorization", auth);
        headers.put("Referer", referer);

        for (String keywords : JobProfileSearchTerms.searchKeywords(profile)) {
            if (out.size() >= 120) break;
            try {
                // build() encodes query values (spaces → %20); build(true) skips encoding and breaks OkHttp
                String url = UriComponentsBuilder.fromHttpUrl(ENDPOINT)
                        .queryParam("locale_code", localeCode)
                        .queryParam("keywords", keywords)
                        .queryParam("location", location)
                        .queryParam("sort", "date")
                        .queryParam("page_size", 50)
                        .queryParam("page", 1)
                        .queryParam("fragment_size", 400)
                        .queryParam("user_ip", userIp)
                        .queryParam("user_agent", DEFAULT_UA)
                        .build()
                        .toUriString();
                String json = http.getWithHeaders(url, DEFAULT_UA, headers);
                if (json == null || json.isBlank()) {
                    log.warn("Careerjet empty response for '{}'", keywords);
                    continue;
                }
                JsonNode root = mapper.readTree(json);
                JsonNode jobs = root.path("jobs");
                if (!jobs.isArray()) {
                    jobs = root.path("hits");
                }
                for (JsonNode row : jobs) {
                    if (out.size() >= 120) break;
                    String title = text(row, "title");
                    String company = text(row, "company");
                    String link = firstUrl(row);
                    if (title.isBlank() || link.isBlank()) continue;
                    if (!seen.add(link)) continue;
                    String loc = firstLocation(row);
                    Job j = Job.builder()
                            .title(title)
                            .company(company.isBlank() ? "Unknown" : company)
                            .location(loc.isBlank() ? location : loc)
                            .description(text(row, "description"))
                            .sourceUrl(link)
                            .sourceName(name())
                            .currency(currencyOf(row))
                            .salaryMin(salaryOf(row, "salary_min"))
                            .salaryMax(salaryOf(row, "salary_max"))
                            .postedAt(parseDate(text(row, "date")))
                            .build();
                    j.setFingerprint(FingerprintUtil.of(j.getCompany(), j.getTitle(), j.getLocation()));
                    out.add(j);
                }
            } catch (Exception e) {
                log.warn("Careerjet fetch failed for '{}': {}", keywords, e.getMessage());
            }
        }
        log.info("Careerjet fetched {} jobs", out.size());
        return out;
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n.path(field);
        return v.isMissingNode() || v.isNull() ? "" : v.asText("").trim();
    }

    private static String firstUrl(JsonNode row) {
        String u = text(row, "url");
        if (!u.isBlank()) return u;
        return text(row, "link");
    }

    private static String firstLocation(JsonNode row) {
        JsonNode locs = row.path("locations");
        if (locs.isArray() && locs.size() > 0) {
            return locs.get(0).asText("").trim();
        }
        String single = text(row, "location");
        if (!single.isBlank()) return single;
        return text(row, "sites");
    }

    private static String currencyOf(JsonNode row) {
        String c = text(row, "salary_currency");
        if (!c.isBlank()) return c.toUpperCase(Locale.ROOT);
        c = text(row, "currency");
        return c.isBlank() ? "EUR" : c.toUpperCase(Locale.ROOT);
    }

    private static Integer salaryOf(JsonNode row, String field) {
        JsonNode v = row.path(field);
        if (v.isMissingNode() || v.isNull()) return null;
        if (v.isNumber()) return v.asInt();
        try {
            String s = v.asText("").replaceAll("[^0-9]", "");
            return s.isBlank() ? null : Integer.parseInt(s);
        } catch (Exception e) {
            return null;
        }
    }

    private static Instant parseDate(String raw) {
        if (raw == null || raw.isBlank()) return Instant.now();
        try {
            return Instant.parse(raw);
        } catch (Exception ignored) {
            // Careerjet often returns yyyy-MM-dd
        }
        try {
            return LocalDate.parse(raw, DateTimeFormatter.ISO_LOCAL_DATE)
                    .atStartOfDay(ZoneOffset.UTC)
                    .toInstant();
        } catch (Exception e) {
            return Instant.now();
        }
    }
}
