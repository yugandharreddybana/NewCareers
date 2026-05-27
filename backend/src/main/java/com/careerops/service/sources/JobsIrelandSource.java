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

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Scrapes JobsIreland.ie (Irish government job board) search results using Jsoup.
 * Searches each target role + location from the user profile and collects up to 30 listings.
 *
 * Free, no API key required. Fail-safe: exceptions return empty list.
 */
@Component
public class JobsIrelandSource implements JobSource {

    private static final Logger log = LoggerFactory.getLogger(JobsIrelandSource.class);
    private static final String BASE = "https://www.jobsireland.ie";
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
                String url = buildSearchUrl(role, location);
                Document doc = Jsoup.connect(url)
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                               "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
                    .timeout(12_000)
                    .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                    .header("Accept-Language", "en-IE,en;q=0.9")
                    .get();

                // Try multiple common selector patterns for job listings
                Elements listings = doc.select("div.job-listing, article.job, div[class*=job-card], li[class*=job]");
                if (listings.isEmpty()) {
                    listings = doc.select("a[href*=/job/], a[href*=/jobs/]");
                }
                if (listings.isEmpty()) {
                    listings = doc.select("h2:has(a), h3:has(a)");
                }

                for (Element el : listings) {
                    if (out.size() >= MAX_TOTAL) break;

                    Element titleEl = el.select("a[href*=/job/], a[href*=/jobs/], h2 a, h3 a, a[class*=title]").first();
                    if (titleEl == null) continue;

                    String title = titleEl.text().trim();
                    String href = titleEl.absUrl("href");
                    if (href.isEmpty()) {
                        href = titleEl.attr("href");
                        if (href.startsWith("/")) href = BASE + href;
                    }

                    String company = extractCompany(el, title);
                    String loc = extractLocation(el, location);

                    if (title.isEmpty() || title.length() > 150) continue;

                    Job j = Job.builder()
                        .title(title)
                        .company(company.isEmpty() ? "Unknown" : company)
                        .location(loc.isEmpty() ? "Ireland" : loc)
                        .sourceUrl(href.isEmpty() ? url : href)
                        .sourceName(name())
                        .currency("EUR")
                        .postedAt(Instant.now())
                        .build();
                    j.setFingerprint(FingerprintUtil.of(j.getCompany(), j.getTitle(), j.getLocation()));
                    out.add(j);
                }

                log.debug("JobsIreland.ie fetched {} listings for role '{}' location '{}'",
                    out.size(), role, location);

            } catch (Exception e) {
                log.warn("JobsIreland.ie fetch failed for role '{}': {}", role, e.getMessage());
            }
        }

        log.info("JobsIreland.ie total collected: {} for roles={}", out.size(), Arrays.toString(roles));
        return out;
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private String buildSearchUrl(String role, String location) {
        StringBuilder sb = new StringBuilder(BASE).append("/en-US/job-search?search=")
            .append(role.trim().replace(" ", "+"));
        if (location != null && !location.isBlank()) {
            sb.append("&location=").append(location.trim().replace(" ", "+"));
        }
        return sb.toString();
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

    private static String extractCompany(Element listingEl, String fallback) {
        // Try common company selectors
        for (String sel : new String[]{
            "[class*=company]", "[class*=employer]", "[class*=organization]",
            "[class*=recruiter]", "span[class*=name]"
        }) {
            Element el = listingEl.select(sel).first();
            if (el != null && !el.text().trim().isEmpty()) {
                String text = el.text().trim();
                if (!text.equalsIgnoreCase(fallback)) return text;
            }
        }
        // Try splitting title "Title at Company"
        int at = fallback.toLowerCase().indexOf(" at ");
        if (at > 0) return fallback.substring(at + 4).trim();
        return "Unknown";
    }

    private static String extractLocation(Element listingEl, String fallback) {
        for (String sel : new String[]{
            "[class*=location]", "[class*=place]", "[class*=region]",
            "[class*=city]", "[class*=address]"
        }) {
            Element el = listingEl.select(sel).first();
            if (el != null && !el.text().trim().isEmpty()) {
                return el.text().trim();
            }
        }
        return fallback != null && !fallback.isBlank() ? fallback : "Ireland";
    }
}
