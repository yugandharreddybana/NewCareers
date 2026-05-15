package com.careerops.service.sources;

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
 * EuroJobs RSS job source — covers EU-wide tech roles.
 *
 * Feed URL: https://www.eurojobs.com/rss/jobs/?q={role}&l=Ireland
 * Free, no API key required. Returns up to 40 results per role.
 * Fetches for each of the user's target roles (up to 3).
 */
@Component
public class EuroJobsSource implements JobSource {

    private static final Logger  log      = LoggerFactory.getLogger(EuroJobsSource.class);
    private static final String  BASE_URL = "https://www.eurojobs.com/rss/jobs/";
    private static final Pattern HTML_TAG = Pattern.compile("<[^>]+>");
    private static final DateTimeFormatter RSS_DATE =
            DateTimeFormatter.ofPattern("EEE, dd MMM yyyy HH:mm:ss zzz", Locale.ENGLISH);
    private static final int MAX_ROLES = 3;

    @Override public String  name()      { return "EuroJobs"; }
    @Override public boolean hasBudget() { return true; }

    @Override
    public List<Job> fetch(UserProfile profile) {
        List<Job> out = new ArrayList<>();
        String[] roles = resolveRoles(profile);
        for (int r = 0; r < Math.min(roles.length, MAX_ROLES); r++) {
            String role = roles[r];
            String url  = BASE_URL + "?q=" + enc(role) + "&l=" + enc("Ireland");
            out.addAll(fetchFeed(url, role));
        }
        log.info("{} total collected: {}", name(), out.size());
        return out;
    }

    private List<Job> fetchFeed(String url, String role) {
        List<Job> out = new ArrayList<>();
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);

            Document doc;
            try (InputStream is = URI.create(url).toURL().openStream()) {
                doc = factory.newDocumentBuilder().parse(is);
            }

            NodeList items = doc.getElementsByTagName("item");
            for (int i = 0; i < items.getLength() && out.size() < 40; i++) {
                Element el    = (Element) items.item(i);
                String  title = text(el, "title");
                String  link  = text(el, "link");
                String  desc  = HTML_TAG.matcher(text(el, "description")).replaceAll("").trim();
                String  pub   = text(el, "pubDate");

                // Try <company> tag, fall back to "Unknown"
                String company = text(el, "company");
                if (company.isBlank()) company = "Unknown";

                String location = text(el, "location");
                if (location.isBlank()) location = "Ireland";

                Instant postedAt = Instant.now();
                if (!pub.isBlank()) {
                    try { postedAt = Instant.from(RSS_DATE.parse(pub)); }
                    catch (DateTimeParseException ignored) {}
                }

                Job j = Job.builder()
                        .id(UUID.randomUUID())
                        .title(title)
                        .company(company)
                        .location(location)
                        .description(desc)
                        .sourceUrl(link)
                        .sourceName(name())
                        .currency("EUR")
                        .postedAt(postedAt)
                        .build();
                j.setFingerprint(FingerprintUtil.of(j.getCompany(), j.getTitle(), j.getLocation()));
                out.add(j);
            }
        } catch (Exception e) {
            log.warn("{} feed failed for role '{}': {}", name(), role, e.getMessage());
        }
        return out;
    }

    private static String[] resolveRoles(UserProfile p) {
        if (p.getTargetRoles() != null && p.getTargetRoles().length > 0) return p.getTargetRoles();
        return new String[]{"software engineer"};
    }

    private static String text(Element el, String tag) {
        NodeList nl = el.getElementsByTagName(tag);
        return nl.getLength() > 0 ? nl.item(0).getTextContent().trim() : "";
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }
}
