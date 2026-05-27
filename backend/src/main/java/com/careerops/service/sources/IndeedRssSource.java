package com.careerops.service.sources;

import com.careerops.dto.SearchParams;
import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Section 7 — Task 69
 * Indeed Ireland RSS feed source.
 *
 * Parses Indeed's standard RSS 2.0 job feed.
 * Feed URL: https://ie.indeed.com/rss?q={query}&l={location}&sort=date&fromage=7
 *
 * Parsing rules:
 *   - title format: "Job Title - Company - Location" (split on " - ")
 *   - description: HTML stripped via regex
 *   - pubDate: RFC 822 format → parsed to Instant
 *   - Sponsorship / remote: keyword heuristic on title + description
 *
 * fetch() — background pipeline: uses profile targetRoles + location, fetches
 *   from ie.indeed.com for Ireland results. Freshness (default 96h) is applied
 *   downstream by JobScrapeService.applyFreshness().
 *
 * search() — on-demand: uses SearchParams query + location.
 *
 * Always hasBudget() = true (free RSS feed, no API key required).
 */
@Component
public class IndeedRssSource implements JobSource {

    private static final Logger log       = LoggerFactory.getLogger(IndeedRssSource.class);
    private static final String RSS_BASE  = "https://ie.indeed.com/rss";
    private static final Pattern HTML_TAG = Pattern.compile("<[^>]+>");
    private static final DateTimeFormatter RSS_DATE =
            DateTimeFormatter.ofPattern("EEE, dd MMM yyyy HH:mm:ss zzz", Locale.ENGLISH);

    private static final String DEFAULT_LOCATION = "Ireland";
    private static final String[] DEFAULT_ROLES  = {"software developer", "software engineer"};

    @Value("${jobs.freshness.default.hours:96}")
    private int defaultFreshnessHours;

    @Override public String    name()      { return "Indeed (RSS)"; }
    @Override public boolean   hasBudget() { return true; }

    // ── Background pipeline (called by JobScrapeService.fetchRaw) ──────────
    //
    // fromage=7 fetches a 7-day window because Indeed RSS only supports
    // fromage values of 1, 3, 7, 14, 30 (no 4-day option).  The user's
    // freshnessHours preference (default 96h / 4 days) is enforced downstream
    // by JobScrapeService.applyFreshness().

    @Override
    public List<Job> fetch(UserProfile profile) {
        String[] roles = resolveRoles(profile);
        String   loc   = resolveLocation(profile);

        List<Job> results = new ArrayList<>();
        for (String role : Arrays.copyOf(roles, Math.min(roles.length, 3))) {
            String feedUrl = RSS_BASE + "?q=" + encode(role)
                           + "&l=" + encode(loc)
                           + "&sort=date&fromage=7";
            try {
                results.addAll(parseFeed(feedUrl, loc));
            } catch (Exception e) {
                log.warn("Indeed fetch failed for role '{}': {}", role, e.getMessage());
            }
        }

        // Apply profile-driven freshness filter (default 96h).
        // fromage=7 gets a 7-day window; trim here so both the background
        // pipeline (JobScrapeService) and live-fetch endpoints get the same cutoff.
        results = applyFreshness(results, profile);

        log.info("Indeed fetch returned {} jobs (after freshness) for roles={}", results.size(), Arrays.toString(roles));
        return results;
    }

    // ── On-demand search ──────────────────────────────────────────────────

    @Override
    public List<Job> search(SearchParams params, UserProfile profile) {
        String q = encode(params.getQuery() != null && !params.getQuery().isBlank()
                         ? params.getQuery() : DEFAULT_ROLES[0]);
        String loc = resolveSearchLocation(params, profile);
        String feedUrl = RSS_BASE + "?q=" + q + "&l=" + encode(loc) + "&sort=date&fromage=7";

        List<Job> results;
        try {
            results = parseFeed(feedUrl, loc);
            log.info("IndeedRSS search returned {} jobs for query '{}'", results.size(), params.getQuery());
        } catch (Exception e) {
            log.warn("IndeedRSS search failed: {}", e.getMessage());
            results = List.of();
        }
        return results;
    }

    // ── Shared RSS parser ─────────────────────────────────────────────────

    /**
     * Parse an Indeed RSS feed URL and return Job objects.
     * @param feedUrl     the full RSS feed URL to fetch
     * @param fallbackLoc location used when the job title doesn't contain a location
     */
    private List<Job> parseFeed(String feedUrl, String fallbackLoc) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        // Security: disable DOCTYPE to prevent XXE attacks
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);

        Document doc;
        try (InputStream is = URI.create(feedUrl).toURL().openStream()) {
            doc = factory.newDocumentBuilder().parse(is);
        }

        String defaultLoc = (fallbackLoc != null && !fallbackLoc.isBlank())
                ? fallbackLoc : DEFAULT_LOCATION;

        List<Job> results = new ArrayList<>();
        NodeList items = doc.getElementsByTagName("item");
        for (int i = 0; i < items.getLength(); i++) {
            Element el = (Element) items.item(i);
            Job job = new Job();
            job.setId(UUID.randomUUID());
            job.setSourceName(name());
            job.setSourceUrl(text(el, "link"));

            // Title: "Job Title - Company - Location"
            String rawTitle = text(el, "title");
            String[] parts  = rawTitle.split(" - ", 3);
            if (parts.length >= 3) {
                job.setTitle(parts[0].trim());
                job.setCompany(parts[1].trim());
                job.setLocation(parts[2].trim());
            } else if (parts.length == 2) {
                job.setTitle(parts[0].trim());
                job.setCompany(parts[1].trim());
                job.setLocation(defaultLoc);
            } else {
                job.setTitle(rawTitle.trim());
                job.setCompany("Unknown");
                job.setLocation(defaultLoc);
            }

            // Strip HTML from description
            String rawDesc = text(el, "description");
            job.setDescription(HTML_TAG.matcher(rawDesc).replaceAll("").trim());

            // Parse pubDate (RFC 822)
            String pubDate = text(el, "pubDate");
            if (!pubDate.isBlank()) {
                try {
                    job.setPostedAt(Instant.from(RSS_DATE.parse(pubDate)));
                } catch (DateTimeParseException ex) {
                    job.setPostedAt(Instant.now());
                }
            } else {
                job.setPostedAt(Instant.now());
            }

            // Keyword heuristics
            String combined = (job.getTitle() + " " + job.getDescription()).toLowerCase();
            job.setSponsorship(
                combined.contains("visa") ||
                combined.contains("sponsorship") ||
                combined.contains("work permit")
            );

            job.setFingerprint(FingerprintUtil.of(job.getCompany(), job.getTitle(),
                job.getLocation(), job.getSalaryMin(), job.getSalaryMax()));
            results.add(job);
        }
        return results;
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private static String[] resolveRoles(UserProfile profile) {
        if (profile.getTargetRoles() != null && profile.getTargetRoles().length > 0) {
            return profile.getTargetRoles();
        }
        return DEFAULT_ROLES;
    }

    private static String resolveLocation(UserProfile profile) {
        if (profile.getLocation() != null && !profile.getLocation().isBlank()) {
            return profile.getLocation();
        }
        return DEFAULT_LOCATION;
    }

    private static String resolveSearchLocation(SearchParams params, UserProfile profile) {
        if (params.getLocation() != null && !params.getLocation().isBlank()
                && !"All Ireland".equalsIgnoreCase(params.getLocation())) {
            return params.getLocation();
        }
        return resolveLocation(profile);
    }

    private static String text(Element el, String tag) {
        NodeList nl = el.getElementsByTagName(tag);
        return nl.getLength() > 0 ? nl.item(0).getTextContent().trim() : "";
    }

    private static String encode(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    private List<Job> applyFreshness(List<Job> jobs, UserProfile profile) {
        int hours = profile.getFreshnessHours() != null
                ? profile.getFreshnessHours() : defaultFreshnessHours;
        Instant cutoff = Instant.now().minus(hours, ChronoUnit.HOURS);
        return jobs.stream()
                .filter(j -> j.getPostedAt() == null || j.getPostedAt().isAfter(cutoff))
                .toList();
    }
}
