package com.careerops.service.sources;

import com.careerops.dto.SearchParams;
import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Section 7 — Task 69
 * Indeed Ireland RSS feed source.
 *
 * Parses Indeed's standard RSS 2.0 job feed.
 * Feed URL: https://www.indeed.com/rss?q={query}&l={location}&sort=date&fromage=7
 *
 * Parsing rules:
 *   - title format: "Job Title - Company - Location" (split on " - ")
 *   - description: HTML stripped via regex
 *   - pubDate: RFC 822 format → parsed to Instant
 *   - Sponsorship / remote: keyword heuristic on title + description
 *
 * fetch() returns empty list — background scraping not supported.
 * Always hasBudget() = true (free RSS feed, no API key required).
 */
@Component
public class IndeedRssSource implements JobSource {

    private static final Logger log       = LoggerFactory.getLogger(IndeedRssSource.class);
    private static final String RSS_BASE  = "https://www.indeed.com/rss";
    private static final Pattern HTML_TAG = Pattern.compile("<[^>]+>");
    private static final DateTimeFormatter RSS_DATE =
            DateTimeFormatter.ofPattern("EEE, dd MMM yyyy HH:mm:ss zzz", Locale.ENGLISH);

    @Override public String    name()               { return "Indeed (RSS)"; }
    @Override public List<Job> fetch(UserProfile p) { return List.of(); }
    @Override public boolean   hasBudget()          { return true; }

    @Override
    public List<Job> search(SearchParams params, UserProfile profile) {
        String q = encode(params.getQuery() != null ? params.getQuery() : "software developer");
        String l = encode(params.getLocation() != null && !params.getLocation().isBlank()
                         ? params.getLocation() : "Dublin, Ireland");
        String feedUrl = RSS_BASE + "?q=" + q + "&l=" + l + "&sort=date&fromage=7";

        List<Job> results = new ArrayList<>();
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            // Security: disable DOCTYPE to prevent XXE attacks
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);

            Document doc;
            try (InputStream is = URI.create(feedUrl).toURL().openStream()) {
                doc = factory.newDocumentBuilder().parse(is);
            }

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
                    job.setLocation(params.getLocation() != null ? params.getLocation() : "Ireland");
                } else {
                    job.setTitle(rawTitle.trim());
                    job.setCompany("Unknown");
                    job.setLocation(params.getLocation() != null ? params.getLocation() : "Ireland");
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

                results.add(job);
            }
            log.info("IndeedRSS returned {} jobs for query '{}'", results.size(), params.getQuery());
        } catch (Exception e) {
            log.warn("IndeedRSS search failed: {}", e.getMessage());
        }
        return results;
    }

    private static String text(Element el, String tag) {
        NodeList nl = el.getElementsByTagName(tag);
        return nl.getLength() > 0 ? nl.item(0).getTextContent().trim() : "";
    }

    private static String encode(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }
}
