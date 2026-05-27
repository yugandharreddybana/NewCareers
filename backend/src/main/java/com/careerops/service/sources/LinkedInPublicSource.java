package com.careerops.service.sources;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.careerops.service.LinkedInDescriptionHelper;
import com.fasterxml.jackson.databind.ObjectMapper;
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
 * Scrapes LinkedIn public job search pages as a free fallback for LinkedIn jobs.
 *
 * LinkedIn is aggressive with bot detection, so this source is best-effort.
 * It attempts to fetch public search results without authentication.
 * If blocked (403/Login wall), it gracefully returns empty results.
 *
 * When Twin AI is enabled and budgeted, TwinAiSource provides better LinkedIn coverage.
 * This source acts as a zero-cost complement.
 *
 * Free, no API key required. Fail-safe: exceptions return empty list.
 */
@Component
public class LinkedInPublicSource implements JobSource {

    private final ObjectMapper mapper = new ObjectMapper();
    private static final Logger log = LoggerFactory.getLogger(LinkedInPublicSource.class);
    private static final String BASE = "https://www.linkedin.com/jobs/search";
    private static final int MAX_TOTAL = 20;
    private static final int MAX_ROLES = 2;

    @Override public String name() { return "LinkedIn (Public)"; }
    @Override public boolean hasBudget() { return true; }

    @Override
    public List<Job> fetch(UserProfile profile) {
        List<Job> out = new ArrayList<>();
        String[] roles = resolveRoles(profile);
        String location = resolveLocation(profile);
        int freshnessDays = resolveFreshnessDays(profile);

        for (String role : Arrays.copyOf(roles, Math.min(roles.length, MAX_ROLES))) {
            try {
                String url = buildSearchUrl(role, location, freshnessDays);
                Document doc = Jsoup.connect(url)
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                               "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
                    .timeout(12_000)
                    .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                    .header("Accept-Language", "en-US,en;q=0.9")
                    .header("Cache-Control", "no-cache")
                    .followRedirects(true)
                    .get();

                // Detect login wall / redirect to auth
                String title = doc.title().toLowerCase();
                if (title.contains("login") || title.contains("sign in") ||
                    doc.select("form#login, .join-form, .auth-wall").first() != null) {
                    log.warn("LinkedIn public search hit login wall for role '{}'", role);
                    continue;
                }

                // LinkedIn job cards — try multiple selector patterns
                Elements cards = doc.select("li.jobs-search-results__list-item, div.base-search-card, article.job-search-card");
                if (cards.isEmpty()) {
                    cards = doc.select("div[class*=job-card], div[class*=search-card]");
                }
                if (cards.isEmpty()) {
                    // Fallback: any link containing /jobs/view/ or /jobs/search/
                    cards = doc.select("a[href*=/jobs/view/]");
                }

                for (Element card : cards) {
                    if (out.size() >= MAX_TOTAL) break;

                    String titleText = extractTitle(card);
                    String company = extractCompany(card);
                    String loc = extractLocation(card, location);
                    String href = extractUrl(card);

                    if (titleText.isEmpty() || titleText.length() > 150) continue;

                    String jobUrl = href.isEmpty()
                        ? (BASE + "?keywords=" + role.replace(" ", "+") + "&location=" + location.replace(" ", "+"))
                        : href;

                    Job j = Job.builder()
                        .title(titleText)
                        .company(company.isEmpty() ? "Unknown" : company)
                        .location(loc.isEmpty() ? location : loc)
                        .sourceUrl(jobUrl)
                        .sourceName(name())
                        .currency("EUR")
                        .postedAt(Instant.now())
                        .build();
                    if (jobUrl.contains("/jobs/view/")) {
                        String desc = LinkedInDescriptionHelper.fetchGuestDescription(jobUrl, mapper);
                        if (desc != null) {
                            j.setDescription(desc.length() > 12_000 ? desc.substring(0, 12_000) + "\n…" : desc);
                        }
                    }
                    j.setFingerprint(FingerprintUtil.of(j.getCompany(), j.getTitle(), j.getLocation()));
                    out.add(j);
                }

                log.debug("LinkedIn public fetched {} listings for role '{}'", out.size(), role);

            } catch (org.jsoup.HttpStatusException e) {
                if (e.getStatusCode() == 403) {
                    log.warn("LinkedIn public search blocked (403) for role '{}'. Consider enabling Twin AI.", role);
                } else {
                    log.warn("LinkedIn public search HTTP {} for role '{}': {}", e.getStatusCode(), role, e.getMessage());
                }
            } catch (Exception e) {
                log.warn("LinkedIn public fetch failed for role '{}': {}", role, e.getMessage());
            }
        }

        log.info("LinkedIn (Public) total collected: {} for roles={}", out.size(), Arrays.toString(roles));
        return out;
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private String buildSearchUrl(String role, String location, int freshnessDays) {
        StringBuilder sb = new StringBuilder(BASE)
            .append("?keywords=").append(role.trim().replace(" ", "+"))
            .append("&location=").append(location.trim().replace(" ", "+"))
            .append("&sortBy=R"); // Recent first

        // LinkedIn time filter: f_TPR=r604800 = past week, r86400 = past day, r2592000 = past month
        if (freshnessDays <= 1) sb.append("&f_TPR=r86400");
        else if (freshnessDays <= 7) sb.append("&f_TPR=r604800");
        else if (freshnessDays <= 30) sb.append("&f_TPR=r2592000");

        return sb.toString();
    }

    private static String[] resolveRoles(UserProfile profile) {
        if (profile.getTargetRoles() != null && profile.getTargetRoles().length > 0) {
            return profile.getTargetRoles();
        }
        return new String[]{"software engineer"};
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

    private static int resolveFreshnessDays(UserProfile profile) {
        if (profile.getFreshnessHours() != null && profile.getFreshnessHours() > 0) {
            return Math.max(1, profile.getFreshnessHours() / 24);
        }
        return 7;
    }

    private static String extractTitle(Element card) {
        for (String sel : new String[]{
            ".base-search-card__title", "h3[class*=title]", "a[class*=title]",
            "span[class*=title]", "h3", "h2", "a.job-card-list__title"
        }) {
            Element el = card.select(sel).first();
            if (el != null && !el.text().trim().isEmpty()) return el.text().trim();
        }
        return "";
    }

    private static String extractCompany(Element card) {
        for (String sel : new String[]{
            ".base-search-card__subtitle", "[class*=company]", "[class*=employer]",
            "[class*=organization-name]", "span[class*=subtitle]"
        }) {
            Element el = card.select(sel).first();
            if (el != null && !el.text().trim().isEmpty()) return el.text().trim();
        }
        return "Unknown";
    }

    private static String extractLocation(Element card, String fallback) {
        for (String sel : new String[]{
            ".job-search-card__location", "[class*=location]", "[class*=place]",
            "[class*=region]", "span[class*=metadata]"
        }) {
            Element el = card.select(sel).first();
            if (el != null && !el.text().trim().isEmpty()) return el.text().trim();
        }
        return fallback != null && !fallback.isBlank() ? fallback : "Ireland";
    }

    private static String extractUrl(Element card) {
        Element a = card.select("a[href*=/jobs/view/]").first();
        if (a != null) {
            String href = a.absUrl("href");
            if (!href.isEmpty()) return href;
            href = a.attr("href");
            if (href.startsWith("/")) return "https://www.linkedin.com" + href;
            return href;
        }
        a = card.select("a[href]").first();
        if (a != null) {
            String href = a.absUrl("href");
            if (!href.isEmpty()) return href;
        }
        return "";
    }
}
