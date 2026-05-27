package com.careerops.service.sources;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import org.jsoup.Jsoup;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Scrapes IrishJobs.ie search results.
 * IrishJobs.ie is a React SPA — job data is embedded as JSON in the page
 * rather than server-rendered HTML, so we use regex-based JSON extraction
 * instead of Jsoup DOM selectors.
 * Searches each target role and collects up to 40 listings per fetch.
 */
@Component
public class IrishJobsSource implements JobSource {
    private static final Logger log = LoggerFactory.getLogger(IrishJobsSource.class);
    private static final String BASE = "https://www.irishjobs.ie";

    // Find opening brace of a JSON object that looks like a job entry
    private static final Pattern OBJECT_START = Pattern.compile("\\{\\s*\"title\"\\s*:");
    // Extract individual fields from a JSON object (order-independent)
    private static final Pattern FIELD_TITLE = Pattern.compile("\"title\"\\s*:\\s*\"([^\"]+)\"");
    private static final Pattern FIELD_URL = Pattern.compile("\"url\"\\s*:\\s*\"([^\"]+)\"");
    private static final Pattern FIELD_COMPANY = Pattern.compile("\"company\"\\s*:\\s*\"([^\"]+)\"");
    private static final Pattern FIELD_LOCATION = Pattern.compile("\"location\"\\s*:\\s*\"([^\"]+)\"");

    // Skip non-job titles
    private static final Set<String> SKIP_TITLES = Set.of(
        "Oh no, this job is no longer available.",
        "Search IrishJobs", "IrishJobs", "Jobs in Ireland"
    );

    @Override public String name() { return "irishjobs"; }

    @Override
    public List<Job> fetch(UserProfile profile) {
        Set<String> seenFingerprints = new HashSet<>();
        List<Job> out = new ArrayList<>();
        String[] roles = (profile.getTargetRoles() == null || profile.getTargetRoles().length == 0)
            ? new String[]{"software engineer", "full stack developer"}
            : profile.getTargetRoles();

        for (String role : Arrays.copyOf(roles, Math.min(roles.length, 3))) {
            try {
                String url = BASE + "/ShowResults.aspx?Keywords="
                    + role.replace(" ", "+") + "&Location=1&Recruiter=Company&SortType=date";
                log.debug("Fetching IrishJobs for role: {}", role);
                String html = Jsoup.connect(url)
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                    .timeout(15_000)
                    .ignoreContentType(true)
                    .execute().body();

                int roleStartCount = out.size();
                Matcher m = OBJECT_START.matcher(html);
                while (m.find() && out.size() < 40) {
                    // Extract the full JSON object via brace-matching
                    String objectJson = extractJsonObject(html, m.start());
                    if (objectJson == null) continue;

                    // Extract fields order-independently
                    Matcher tMatcher = FIELD_TITLE.matcher(objectJson);
                    if (!tMatcher.find()) continue;
                    String title = cleanTitle(tMatcher.group(1));
                    if (title.isEmpty() || SKIP_TITLES.contains(title)) continue;

                    Matcher uMatcher = FIELD_URL.matcher(objectJson);
                    if (!uMatcher.find()) continue;
                    String relUrl = uMatcher.group(1);
                    String jobUrl = relUrl.startsWith("http") ? relUrl : BASE + relUrl;

                    // Extract company: try JSON field first, fall back to URL slug
                    String company = "Unknown";
                    Matcher cMatcher = FIELD_COMPANY.matcher(objectJson);
                    if (cMatcher.find()) {
                        company = cMatcher.group(1).trim();
                    } else {
                        company = extractCompanyFromUrl(relUrl);
                    }

                    // Extract location
                    String location = "Ireland";
                    Matcher lMatcher = FIELD_LOCATION.matcher(objectJson);
                    if (lMatcher.find()) location = lMatcher.group(1).trim();

                    String fp = FingerprintUtil.of(company, title, location);
                    if (!seenFingerprints.add(fp)) continue;

                    Job j = Job.builder()
                        .title(title).company(company).location(location)
                        .sourceUrl(jobUrl).sourceName("IrishJobs").currency("EUR")
                        .postedAt(Instant.now()).build();
                    j.setFingerprint(fp);
                    out.add(j);
                }
                int roleCount = out.size() - roleStartCount;
                log.info("IrishJobs fetched {} jobs for role '{}' ({} total)", roleCount, role, out.size());
            } catch (Exception e) {
                log.warn("IrishJobs fetch failed for role '{}': {}", role, e.getMessage());
            }
        }
        return out;
    }

    /** Clean title text — trim, collapse whitespace, enforce max length. */
    private static String cleanTitle(String raw) {
        String t = raw.replaceAll("\\s+", " ").trim();
        return t.length() > 150 ? t.substring(0, 147) + "..." : t;
    }

    /**
     * Extract a full JSON object (balanced braces) starting at braceStart.
     * Returns the substring from the opening { to its matching }, or null.
     */
    private static String extractJsonObject(String html, int braceStart) {
        int depth = 0;
        int i = braceStart;
        // Find the opening brace
        while (i < html.length() && html.charAt(i) != '{') i++;
        int start = i;
        // Walk forward matching braces, handling strings
        boolean inString = false;
        int maxIter = Math.min(html.length() - start, 50_000);
        int safety = 0;
        while (i < html.length() && safety < maxIter) {
            char c = html.charAt(i);
            if (inString) {
                if (c == '\\') { i += 2; safety++; continue; }  // skip escaped char
                if (c == '"') inString = false;
            } else {
                if (c == '"') inString = true;
                else if (c == '{') depth++;
                else if (c == '}') {
                    depth--;
                    if (depth == 0) return html.substring(start, i + 1);
                }
            }
            i++;
            safety++;
        }
        return null;
    }

    /**
     * Extract company name from a URL slug like
     * /job/senior-software-engineer/google-ireland-ltd-job107389008
     * → "Google Ireland Ltd"
     */
    static String extractCompanyFromUrl(String url) {
        // Find the last path segment that looks like a company name (hyphenated words before -jobNNN)
        int lastSlash = url.lastIndexOf('/');
        if (lastSlash < 0) return "Unknown";

        String[] segments = url.substring(lastSlash + 1).split("/");
        String lastSegment = segments[segments.length - 1];

        // Remove trailing -jobNNNNNNN if present
        lastSegment = lastSegment.replaceAll("-job\\d+$", "");

        if (lastSegment.isEmpty()) return "Unknown";

        // Convert hyphenated slug to title case: "google-ireland-ltd" → "Google Ireland Ltd"
        String[] words = lastSegment.split("-");
        StringBuilder sb = new StringBuilder();
        for (String w : words) {
            if (w.isEmpty()) continue;
            if (!sb.isEmpty()) sb.append(' ');
            // Handle common abbreviations
            String upper = w.toUpperCase();
            if (upper.equals("LTD") || upper.equals("LLC") || upper.equals("PLC")
                || upper.equals("INC") || upper.equals("CORP") || upper.equals("GMBH")
                || upper.equals("AWS") || upper.equals("AI") || upper.equals("IT")
                || upper.equals("UK") || upper.equals("USA") || upper.equals("HR")) {
                sb.append(upper);
            } else if (w.length() <= 3) {
                sb.append(upper);
            } else {
                sb.append(Character.toUpperCase(w.charAt(0)));
                sb.append(w.substring(1).toLowerCase());
            }
        }
        String result = sb.toString().trim();
        return result.isEmpty() ? "Unknown" : result;
    }
}
