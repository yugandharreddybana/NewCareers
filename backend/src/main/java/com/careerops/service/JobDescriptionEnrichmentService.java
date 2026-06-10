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

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

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
    private final Set<UUID> salaryFetchAttempted = ConcurrentHashMap.newKeySet();

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
        stripLegacySalaryScanMarker(job);
        backfillSalaryFromDescription(job);
        if (needsLongerDescription(job)) {
            job = enrich(job, hasDescription(job));
        }
        if (needsSalaryFromSource(job) && hasDescription(job) && !salaryFetchAttempted.contains(job.getId())) {
            job = enrichSalaryFromSource(job);
        }
        return job;
    }

    /**
     * @param force when true, re-fetches even if a short or stale description exists
     */
    @Transactional
    public Job enrich(Job job, boolean force) {
        if (job == null) return null;
        if (force) {
            salaryFetchAttempted.remove(job.getId());
            stripLegacySalaryScanMarker(job);
        }
        if (!force && hasDescription(job)) return job;

        String url = job.getSourceUrl();
        if (url == null || url.isBlank()) return job;

        PageFetchResult fetched;
        try {
            fetched = fetchPage(url.trim());
        } catch (IllegalArgumentException e) {
            log.debug("Skipped job description fetch for {}: {}", url, e.getMessage());
            return job;
        }
        if (fetched == null || fetched.description() == null || fetched.description().length() < MIN_USEFUL_LENGTH) {
            applySalary(job, fetched != null ? fetched.salary() : null);
            if (job.getSalaryMin() != null || job.getSalaryMax() != null) {
                jobs.save(job);
            }
            return job;
        }

        String description = fetched.description();
        if (description.length() > MAX_DESC) {
            description = description.substring(0, MAX_DESC) + "\n…";
        }
        description = JobDescriptionNormalizer.normalize(description);
        job.setDescription(description);
        applySalary(job, fetched.salary());
        jobs.save(job);
        log.info("Enriched job description for {} at {} ({} chars)", job.getTitle(), job.getCompany(), description.length());
        return job;
    }

    @Transactional
    public Job enrichSalaryFromSource(Job job) {
        if (job == null || !needsSalaryFromSource(job) || salaryFetchAttempted.contains(job.getId())) {
            return job;
        }
        salaryFetchAttempted.add(job.getId());
        String url = job.getSourceUrl();
        if (url == null || url.isBlank()) return job;
        JobSalaryExtractor.SalaryInfo extracted = null;
        try {
            PageFetchResult fetched = fetchPage(url.trim());
            if (fetched != null) {
                extracted = fetched.salary();
                applySalary(job, extracted);
            }
        } catch (IllegalArgumentException e) {
            log.debug("Skipped salary fetch for {}: {}", url, e.getMessage());
        }
        jobs.save(job);

        if (job.getSalaryMin() != null || job.getSalaryMax() != null) {
            log.info("Backfilled salary for {} at {} ({}-{})",
                    job.getTitle(), job.getCompany(), job.getSalaryMin(), job.getSalaryMax());
        }
        return job;
    }

    private void stripLegacySalaryScanMarker(Job job) {
        if (job == null || job.getDescription() == null) return;
        if (!job.getDescription().contains(JobDescriptionNormalizer.SALARY_SCAN_MARKER)) return;
        job.setDescription(JobDescriptionNormalizer.normalize(job.getDescription()));
        jobs.save(job);
    }

    private static String urlHost(String url) {
        try {
            return java.net.URI.create(url.trim()).getHost();
        } catch (Exception e) {
            return "unknown";
        }
    }

    private void backfillSalaryFromDescription(Job job) {
        if (job == null || !needsSalaryFromSource(job)) return;
        JobSalaryExtractor.SalaryInfo parsed = JobSalaryExtractor.parse(job.getDescription());
        if (!parsed.hasStructured()) return;
        applySalary(job, parsed);
        jobs.save(job);
        log.debug("Parsed salary from description for {} at {} ({}-{})",
                job.getTitle(), job.getCompany(), job.getSalaryMin(), job.getSalaryMax());
    }

    private static boolean needsSalaryFromSource(Job job) {
        return job.getSalaryMin() == null && job.getSalaryMax() == null;
    }

    private static void applySalary(Job job, JobSalaryExtractor.SalaryInfo salary) {
        if (job == null || salary == null) return;
        if (salary.min() != null) job.setSalaryMin(salary.min());
        if (salary.max() != null) job.setSalaryMax(salary.max());
        if (salary.currency() != null && !salary.currency().isBlank()) {
            job.setCurrency(salary.currency());
        }
    }

    private record PageFetchResult(String description, JobSalaryExtractor.SalaryInfo salary) {}

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
        PageFetchResult result = fetchPage(url);
        return result != null ? result.description() : null;
    }

    private PageFetchResult fetchPage(String url) {
        if (LinkedInDescriptionHelper.isLinkedInJobUrl(url)) {
            String guest = LinkedInDescriptionHelper.fetchGuestDescription(url, mapper);
            if (guest != null) {
                JobSalaryExtractor.SalaryInfo salary = JobSalaryExtractor.parse(guest);
                return new PageFetchResult(guest, salary);
            }
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
            JobSalaryExtractor.SalaryInfo salary = JobSalaryExtractor.parseFromHtml(html);
            String description = null;
            if (StepstoneDescriptionHelper.isStepstoneJobUrl(url)) {
                description = StepstoneDescriptionHelper.extractFromHtml(html);
            }
            if (description == null) {
                description = parseDescriptionFromDocument(doc, url);
            }
            description = prependSalaryLine(description, salary);
            return new PageFetchResult(description, salary);
        } catch (Exception e) {
            log.debug("Could not fetch description from {}: {}", url, e.getMessage());
        }
        return null;
    }

    private static String prependSalaryLine(String description, JobSalaryExtractor.SalaryInfo salary) {
        if (description == null || salary == null) return description;
        if (!salary.hasStructured() && !salary.hasDisplay()) return description;
        if (description.toLowerCase().contains("salary:")) return description;
        String label = salary.displayLabel();
        if (label == null || label.isBlank()) return description;
        if (label.toLowerCase().contains("competitive") && !label.contains("€")) return description;
        return "Salary: " + label.trim() + "\n\n" + description;
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
