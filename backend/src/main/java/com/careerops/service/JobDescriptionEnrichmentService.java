package com.careerops.service;

import com.careerops.security.SafeUrlFetcher;
import com.careerops.model.Job;
import com.careerops.repository.JobRepository;
import com.careerops.service.sources.StepstoneDescriptionHelper;
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
    private static final int MAX_DESC = 50_000;
    private static final int MIN_USEFUL_LENGTH = 80;
    /** Descriptions shorter than this are treated as snippets and re-fetched when possible. */
    private static final int SHORT_DESC_THRESHOLD = 500;

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
        if (needsLongerDescription(job)) {
            return enrich(job, hasDescription(job));
        }
        return job;
    }

    /**
     * @param force when true, re-fetches even if a short or stale description exists
     */
    @Transactional
    public Job enrich(Job job, boolean force) {
        if (job == null) return null;
        if (!force && hasDescription(job)) return job;

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
        if (d == null || d.isBlank()) return false;
        String plain = StepstoneDescriptionHelper.toPlainText(d);
        return plain != null && plain.length() >= MIN_USEFUL_LENGTH;
    }

    private static boolean needsLongerDescription(Job job) {
        if (!hasDescription(job)) return true;
        String plain = StepstoneDescriptionHelper.toPlainText(job.getDescription());
        return plain == null || plain.length() < SHORT_DESC_THRESHOLD;
    }

    String fetchDescription(String url) {
        if (LinkedInDescriptionHelper.isLinkedInJobUrl(url)) {
            String guest = LinkedInDescriptionHelper.fetchGuestDescription(url, mapper);
            if (guest != null) return guest;
        }
        try {
            String safeUrl = SafeUrlFetcher.validateFetchUrl(url).toString();
            int timeoutMs = StepstoneDescriptionHelper.isStepstoneJobUrl(url) ? 20_000 : 12_000;
            Document doc = Jsoup.connect(safeUrl)
                .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    + "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
                .timeout(timeoutMs)
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header("Accept-Language", "en-US,en;q=0.9")
                .followRedirects(true)
                .get();

            String title = doc.title().toLowerCase();
            if (title.contains("login") || title.contains("sign in")
                || doc.select("form#login, .auth-wall").first() != null) {
                return null;
            }

            String html = doc.outerHtml();
            if (StepstoneDescriptionHelper.isStepstoneJobUrl(url)) {
                String stepstone = StepstoneDescriptionHelper.extractFromHtml(html);
                if (stepstone != null) return stepstone;
            }

            return parseDescriptionFromDocument(doc, url);
        } catch (Exception e) {
            log.debug("Could not fetch description from {}: {}", url, e.getMessage());
        }
        return null;
    }

    /** Package-visible for unit tests (HTML already fetched). */
    String parseDescriptionFromDocument(Document doc, String url) {
        java.util.List<String> candidates = new java.util.ArrayList<>();

        if (url.contains("linkedin.com")) {
            addCandidate(candidates, descriptionFromLinkedIn(doc));
        }

        for (String sel : new String[]{
            "[data-at=job-ad-content]",
            "[data-testid=job-ad-content]",
            ".job-ad-content",
            ".jobDescription",
            "#job-description",
            "[class*=job-description]",
            "[class*=JobDescription]",
            ".show-more-less-html__markup",
        }) {
            Element block = doc.selectFirst(sel);
            if (block != null) {
                addCandidate(candidates, htmlElementToPlain(block));
            }
        }

        Element article = doc.selectFirst("article, main, [role=main]");
        if (article != null) {
            addCandidate(candidates, htmlElementToPlain(article));
        }

        addCandidate(candidates, descriptionFromJsonLd(doc));

        String og = metaContent(doc, "meta[property=og:description]");
        if (og != null) {
            addCandidate(candidates, StepstoneDescriptionHelper.toPlainText(og));
        }

        return candidates.stream()
                .max(java.util.Comparator.comparingInt(String::length))
                .map(JobDescriptionEnrichmentService::capDescription)
                .orElse(null);
    }

    private static void addCandidate(java.util.List<String> candidates, String text) {
        if (text == null || text.length() < MIN_USEFUL_LENGTH) return;
        candidates.add(text);
    }

    private static String capDescription(String text) {
        if (text.length() <= MAX_DESC) return text;
        return text.substring(0, MAX_DESC) + "\n…";
    }

    private static String htmlElementToPlain(Element el) {
        if (el == null) return null;
        String html = el.html();
        if (html != null && html.contains("<")) {
            return StepstoneDescriptionHelper.toPlainText(html);
        }
        String text = el.text().trim();
        return text.isEmpty() ? null : text;
    }

    private static String descriptionFromLinkedIn(Document doc) {
        for (String sel : new String[]{
            ".show-more-less-html__markup",
            ".description__text",
            "div[class*=description__text]",
            "div[class*=jobs-description]",
            "#job-details"
        }) {
            Element el = doc.select(sel).first();
            if (el != null) {
                String text = htmlElementToPlain(el);
                if (text != null && text.length() >= MIN_USEFUL_LENGTH) return text;
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
            if (!d.isEmpty()) {
                String plain = StepstoneDescriptionHelper.toPlainText(d);
                if (plain != null) return plain;
            }
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
