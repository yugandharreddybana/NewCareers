package com.careerops.service.sources;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
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
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Scrapes JobsIreland.ie (government job board) via the browse-vacancies page and API.
 * Avoids www — redirects duplicate query parameters and break search URLs.
 */
@Component
public class JobsIrelandSource implements JobSource {

    private static final Logger log = LoggerFactory.getLogger(JobsIrelandSource.class);
    private static final String BASE = "https://jobsireland.ie";
    private static final int MAX_TOTAL = 30;
    private static final int MAX_ROLES = 3;

    @Override public String name() { return "JobsIreland.ie"; }

    @Override
    public List<Job> fetch(UserProfile profile) {
        List<Job> out = new ArrayList<>();
        String[] roles = resolveRoles(profile);
        String location = resolveLocation(profile);

        for (String role : Arrays.copyOf(roles, Math.min(roles.length, MAX_ROLES))) {
            try {
                List<Job> batch = fetchRole(role, location);
                for (Job j : batch) {
                    if (out.size() >= MAX_TOTAL) {
                        break;
                    }
                    if (matchesRole(j.getTitle(), role)) {
                        out.add(j);
                    }
                }
            } catch (Exception e) {
                log.warn("JobsIreland.ie fetch failed for role '{}': {}", role, e.getMessage());
            }
        }

        if (out.isEmpty()) {
            try {
                for (Job j : fetchBrowsePageFallback(MAX_TOTAL * 2)) {
                    if (out.size() >= MAX_TOTAL) {
                        break;
                    }
                    if (matchesAnyRole(j.getTitle(), roles)) {
                        out.add(j);
                    }
                }
            } catch (Exception e) {
                log.warn("JobsIreland.ie browse fallback failed: {}", e.getMessage());
            }
        }

        log.info("JobsIreland.ie total collected: {} for roles={}", out.size(), Arrays.toString(roles));
        return out;
    }

    private List<Job> fetchRole(String role, String location) throws Exception {
        String q = URLEncoder.encode(role.trim(), StandardCharsets.UTF_8);
        String loc = URLEncoder.encode(location.trim(), StandardCharsets.UTF_8);
        String apiUrl = BASE + "/Jobsireland.API/JobsIreland/BrowseJobs"
            + "?keyWord=" + q + "&location=" + loc + "&page=1&pageSize=30";
        Document doc = connect(apiUrl);
        List<Job> parsed = parseJobHeadings(doc);
        if (!parsed.isEmpty()) {
            return parsed;
        }
        String browseUrl = BASE + "/en-US/browse-jobs";
        return parseJobHeadings(connect(browseUrl));
    }

    private List<Job> fetchBrowsePageFallback(int limit) throws Exception {
        return parseJobHeadings(connect(BASE + "/en-US/browse-jobs")).stream()
            .limit(limit)
            .toList();
    }

    private static Document connect(String url) throws Exception {
        return Jsoup.connect(url)
            .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
            .timeout(20_000)
            .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
            .header("Accept-Language", "en-IE,en;q=0.9")
            .get();
    }

    private static List<Job> parseJobHeadings(Document doc) {
        List<Job> out = new ArrayList<>();
        Elements headings = doc.select("div.job-heading[data-vacancyid]");
        for (Element heading : headings) {
            String vacancyId = heading.attr("data-vacancyid");
            if (vacancyId.isBlank()) {
                continue;
            }
            Element titleInput = heading.select("input#JobTitle").first();
            Element locationInput = heading.select("input#Location").first();
            String title = titleInput != null ? titleInput.attr("value").trim() : "";
            if (title.isBlank()) {
                Element h3 = heading.select("h3").first();
                title = h3 != null ? h3.text().trim() : "";
            }
            if (title.isBlank()) {
                continue;
            }
            String loc = locationInput != null ? locationInput.attr("value").trim() : "Ireland";
            String company = extractCompanyFromHeading(heading);
            String detailUrl = BASE + "/en-US/job-Details?id=" + vacancyId;

            Job j = Job.builder()
                .title(title)
                .company(company.isBlank() ? "Unknown" : company)
                .location(loc.isBlank() ? "Ireland" : loc)
                .sourceUrl(detailUrl)
                .sourceName("JobsIreland.ie")
                .currency("EUR")
                .postedAt(Instant.now())
                .build();
            j.setFingerprint(FingerprintUtil.of(j.getCompany(), j.getTitle(), j.getLocation()));
            out.add(j);
        }
        return out;
    }

    private static String extractCompanyFromHeading(Element heading) {
        Element logo = heading.select("img[alt]").first();
        if (logo != null) {
            String alt = logo.attr("alt").trim();
            if (alt.toLowerCase(Locale.ROOT).startsWith("logo of ")) {
                return alt.substring(8).trim();
            }
        }
        return "Unknown";
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

    private static boolean matchesAnyRole(String title, String[] roles) {
        for (String role : roles) {
            if (matchesRole(title, role)) {
                return true;
            }
        }
        return false;
    }

    private static String[] resolveRoles(UserProfile profile) {
        if (profile.getTargetRoles() != null && profile.getTargetRoles().length > 0) {
            return profile.getTargetRoles();
        }
        return new String[]{"software engineer", "full stack developer"};
    }

    private static String resolveLocation(UserProfile profile) {
        if (profile.getLocation() != null && !profile.getLocation().isBlank()) {
            return profile.getLocation();
        }
        if (profile.getGoalLocation() != null && !profile.getGoalLocation().isBlank()) {
            return profile.getGoalLocation();
        }
        return "Ireland";
    }
}
