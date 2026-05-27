package com.careerops.service;

import com.careerops.security.SafeUrlFetcher;
import com.careerops.model.Job;
import com.careerops.repository.JobRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Best-effort fetch of job posting text when sources (e.g. LinkedIn search cards)
 * only provide title, company, and URL.
 */
@Service
public class JobDescriptionEnrichmentService {

    private static final Logger log = LoggerFactory.getLogger(JobDescriptionEnrichmentService.class);
    private static final int MAX_DESC = 12_000;
    private static final int MIN_USEFUL_LENGTH = 80;

    private final JobRepository jobs;
    private final ObjectMapper mapper;

    public JobDescriptionEnrichmentService(JobRepository jobs, ObjectMapper mapper) {
        this.jobs = jobs;
        this.mapper = mapper;
    }

    /**
     * Fetches and persists a description when missing. Returns the same entity
     * (possibly updated) — safe to call on every detail request.
     */
    @Transactional
    public Job enrichIfMissing(Job job) {
        if (job == null) return null;
        if (hasDescription(job)) return job;

        String url = job.getSourceUrl();
        if (url == null || url.isBlank()) return job;

        String fetched;
        try {
            fetched = fetchDescription(url.trim());
        } catch (IllegalArgumentException e) {
            log.debug("Skipped job description fetch for {}: {}", url, e.getMessage());
            return job;
        }
        if (fetched == null || fetched.length() < MIN_USEFUL_LENGTH) return job;

        if (fetched.length() > MAX_DESC) {
            fetched = fetched.substring(0, MAX_DESC) + "\n…";
        }
        job.setDescription(fetched);
        jobs.save(job);
        log.info("Enriched job description for {} at {} ({} chars)", job.getTitle(), job.getCompany(), fetched.length());
        return job;
    }

    private static boolean hasDescription(Job job) {
        String d = job.getDescription();
        return d != null && !d.isBlank();
    }

    String fetchDescription(String url) {
        if (LinkedInDescriptionHelper.isLinkedInJobUrl(url)) {
            String guest = LinkedInDescriptionHelper.fetchGuestDescription(url, mapper);
            if (guest != null) return guest;
        }
        try {
            String safeUrl = SafeUrlFetcher.validateFetchUrl(url).toString();
            Document doc = Jsoup.connect(safeUrl)
                .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    + "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
                .timeout(10_000)
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header("Accept-Language", "en-US,en;q=0.9")
                .followRedirects(true)
                .get();

            String title = doc.title().toLowerCase();
            if (title.contains("login") || title.contains("sign in")
                || doc.select("form#login, .auth-wall").first() != null) {
                return null;
            }

            return parseDescriptionFromDocument(doc, url);
        } catch (Exception e) {
            log.debug("Could not fetch description from {}: {}", url, e.getMessage());
        }
        return null;
    }

    /** Package-visible for unit tests (HTML already fetched). */
    String parseDescriptionFromDocument(Document doc, String url) {
        String fromLd = descriptionFromJsonLd(doc);
        if (fromLd != null) return fromLd;

        String og = metaContent(doc, "meta[property=og:description]");
        if (og != null && og.length() >= MIN_USEFUL_LENGTH) return og;

        if (url.contains("linkedin.com")) {
            String linkedIn = descriptionFromLinkedIn(doc);
            if (linkedIn != null) return linkedIn;
        }

        Element article = doc.selectFirst("article, main, [role=main]");
        if (article != null) {
            String text = article.text().trim();
            if (text.length() >= MIN_USEFUL_LENGTH) {
                return text.length() > MAX_DESC ? text.substring(0, MAX_DESC) : text;
            }
        }
        return null;
    }

    private static String descriptionFromLinkedIn(Document doc) {
        for (String sel : new String[]{
            ".description__text",
            ".show-more-less-html__markup",
            "div[class*=description__text]",
            "div[class*=jobs-description]",
            "#job-details"
        }) {
            Element el = doc.select(sel).first();
            if (el != null) {
                String text = el.text().trim();
                if (text.length() >= MIN_USEFUL_LENGTH) return text;
            }
        }
        return null;
    }

    private String descriptionFromJsonLd(Document doc) {
        for (Element script : doc.select("script[type=application/ld+json]")) {
            try {
                JsonNode root = mapper.readTree(script.data());
                String d = extractDescriptionNode(root);
                if (d != null && d.length() >= MIN_USEFUL_LENGTH) return d;
            } catch (Exception ignored) {
                // try next script block
            }
        }
        return null;
    }

    private static String extractDescriptionNode(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isArray()) {
            for (JsonNode child : node) {
                String d = extractDescriptionNode(child);
                if (d != null) return d;
            }
            return null;
        }
        if (node.has("description")) {
            String d = node.get("description").asText("").trim();
            if (!d.isEmpty()) return d;
        }
        if (node.has("@graph")) {
            return extractDescriptionNode(node.get("@graph"));
        }
        return null;
    }

    private static String metaContent(Document doc, String selector) {
        Element el = doc.selectFirst(selector);
        if (el == null) return null;
        String content = el.attr("content").trim();
        return content.isEmpty() ? null : content;
    }
}
