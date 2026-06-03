package com.careerops.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Fetches LinkedIn job descriptions via the public guest API (no auth).
 * Used when search cards only provide title, company, and view URL.
 */
public final class LinkedInDescriptionHelper {

    private static final Pattern JOB_ID =
            Pattern.compile("/jobs/view/(?:[^/?#]*-)?([0-9]{8,})");
    private static final String GUEST_API =
            "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/";
    private static final int MIN_USEFUL_LENGTH = 80;
    private static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    + "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

    private static final String[] DESCRIPTION_SELECTORS = {
            ".description__text",
            ".show-more-less-html__markup",
            "div[class*=description__text]",
            "div[class*=jobs-description]",
            "#job-details",
            ".jobs-description__content",
            "section.description",
    };

    private LinkedInDescriptionHelper() {}

    public static boolean isLinkedInJobUrl(String url) {
        return url != null && url.toLowerCase().contains("linkedin.com/jobs");
    }

    public static Optional<String> extractJobId(String url) {
        if (url == null || url.isBlank()) return Optional.empty();
        Matcher m = JOB_ID.matcher(url);
        if (m.find()) return Optional.of(m.group(1));
        Matcher trailing = Pattern.compile("([0-9]{10,})").matcher(url);
        if (trailing.find()) return Optional.of(trailing.group(1));
        return Optional.empty();
    }

    /**
     * @return plain-text description or null if unavailable
     */
    public static String fetchGuestDescription(String jobPageUrl, ObjectMapper mapper) {
        Optional<String> jobId = extractJobId(jobPageUrl);
        if (jobId.isEmpty()) return null;
        try {
            String body = Jsoup.connect(GUEST_API + jobId.get())
                    .userAgent(USER_AGENT)
                    .timeout(12_000)
                    .ignoreContentType(true)
                    .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                    .header("Accept-Language", "en-US,en;q=0.9")
                    .referrer("https://www.linkedin.com/jobs/")
                    .execute()
                    .body();
            if (body == null || body.isBlank()) return null;

            String text = parseGuestResponseBody(body, mapper);
            return text != null && text.length() >= MIN_USEFUL_LENGTH ? text : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    /**
     * Guest jobPosting endpoint returns HTML; older integrations sometimes return JSON.
     */
    static String parseGuestResponseBody(String body, ObjectMapper mapper) {
        String trimmed = body.strip();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            try {
                JsonNode root = mapper.readTree(trimmed);
                String html = root.path("description").asText("").trim();
                if (!html.isEmpty()) {
                    String text = htmlToPlainText(html);
                    if (text.length() >= MIN_USEFUL_LENGTH) return text;
                }
            } catch (Exception ignored) {
                // fall through to HTML parse
            }
        }
        return descriptionFromHtmlDocument(Jsoup.parse(body));
    }

    static String descriptionFromHtmlDocument(Document doc) {
        for (String sel : DESCRIPTION_SELECTORS) {
            Element el = doc.select(sel).first();
            if (el != null) {
                String text = el.text().trim();
                if (text.length() >= MIN_USEFUL_LENGTH) return text;
            }
        }
        Element body = doc.body();
        if (body != null) {
            String text = body.text().trim();
            if (text.length() >= MIN_USEFUL_LENGTH) return text;
        }
        String text = doc.text().trim();
        return text.length() >= MIN_USEFUL_LENGTH ? text : null;
    }

    static String htmlToPlainText(String html) {
        Document doc = Jsoup.parse(html);
        doc.select("button, [class*=show-more], [class*=show-less]").remove();
        doc.select("br").prepend("\n");
        doc.select("p, li, h1, h2, h3, h4, div[class*=description]").prepend("\n");
        String text = doc.text()
                .replace('\u00a0', ' ')
                .replaceAll("(?i)\\bshow\\s+more\\b", "")
                .replaceAll("(?i)\\bshow\\s+less\\b", "")
                .replaceAll("[ \\t]+", " ")
                .replaceAll("\\n{3,}", "\n\n")
                .trim();
        return text;
    }
}
