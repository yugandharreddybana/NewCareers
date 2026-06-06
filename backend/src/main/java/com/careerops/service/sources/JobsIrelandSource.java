package com.careerops.service.sources;

import com.careerops.model.JobListing;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Scrapes the Irish Government's public job-board at jobsireland.ie.
 */
@Component
public class JobsIrelandSource implements JobSource {

    private static final Logger log = LoggerFactory.getLogger(JobsIrelandSource.class);
    private static final String BASE = "https://www.jobsireland.ie/#/search?term=";
    // JobsIreland is an SPA; fall back to their REST-like JSON endpoint
    private static final String API  = "https://www.jobsireland.ie/api/joboffers?keyword=%s&offset=0&limit=50";

    @Override public String name() { return "JobsIreland.ie"; }

    @Override
    public List<JobListing> fetch(String keyword, String location, int maxAgeDays) {
        List<JobListing> results = new ArrayList<>();
        try {
            String url = String.format(API, URLEncoder.encode(keyword, StandardCharsets.UTF_8));
            String json = Jsoup.connect(url)
                    .userAgent("Mozilla/5.0 (compatible; CareerOps/1.0)")
                    .ignoreContentType(true).timeout(15_000).get().text();
            Instant cutoff = maxAgeDays > 0 ? Instant.now().minus(maxAgeDays, ChronoUnit.DAYS) : null;
            // Simple JSON parse without Jackson dependency on the source layer
            String[] entries = json.split("\\{\"id\"");
            for (int i = 1; i < entries.length; i++) {
                try {
                    String entry = "{\"id\"" + entries[i];
                    String title   = extractJson(entry, "jobTitle");
                    String company = extractJson(entry, "employerName");
                    String loc     = extractJson(entry, "location");
                    String id      = extractJson(entry, "id");
                    String dateStr = extractJson(entry, "datePosted");
                    Instant posted = null;
                    if (dateStr != null && !dateStr.isBlank()) {
                        try { posted = Instant.parse(dateStr); } catch (Exception ignored) {}
                    }
                    if (cutoff != null && posted != null && posted.isBefore(cutoff)) continue;
                    JobListing j = new JobListing();
                    j.setTitle(title); j.setCompany(company); j.setLocation(loc);
                    j.setUrl("https://www.jobsireland.ie/#/job-offer/" + id);
                    j.setSource(name()); j.setPostedAt(posted);
                    results.add(j);
                } catch (Exception e) { log.debug("JobsIreland entry parse", e); }
            }
        } catch (Exception e) { log.warn("JobsIreland fetch failed: {}", e.getMessage()); }
        return results;
    }

    private String extractJson(String json, String key) {
        String search = "\"" + key + "\":\"";
        int start = json.indexOf(search);
        if (start < 0) return "";
        start += search.length();
        int end = json.indexOf("\"", start);
        return end < 0 ? "" : json.substring(start, end);
    }

    static boolean matchesRole(String title, String role) {
        if (role == null || role.isBlank()) {
            return true;
        }
        if (title == null || title.isBlank()) {
            return false;
        }
        String t = title.toLowerCase(Locale.ROOT);
        String r = role.toLowerCase(Locale.ROOT).trim();
        if (t.contains(r)) {
            return true;
        }
        String[] tokens = Arrays.stream(r.split("\\s+"))
            .filter(tok -> tok.length() >= 3)
            .toArray(String[]::new);
        if (tokens.length == 0) {
            return false;
        }
        int hits = 0;
        for (String token : tokens) {
            if (t.contains(token)) {
                hits++;
            }
        }
        if (tokens.length >= 2) {
            return hits >= 2;
        }
        return hits >= 1;
    }
}
