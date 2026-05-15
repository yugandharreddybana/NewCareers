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
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * WeWorkRemotely RSS job source.
 *
 * Fetches from the free public RSS feed at https://weworkremotely.com/remote-jobs.rss
 * No API key required. Returns up to 50 remote-first jobs per fetch.
 * Only fetch() is supported — search() returns empty (no query param support in RSS).
 */
@Component
public class WeWorkRemotelySource implements JobSource {

    private static final Logger  log      = LoggerFactory.getLogger(WeWorkRemotelySource.class);
    private static final String  FEED_URL = "https://weworkremotely.com/remote-jobs.rss";
    private static final Pattern HTML_TAG = Pattern.compile("<[^>]+>");
    private static final DateTimeFormatter RSS_DATE =
            DateTimeFormatter.ofPattern("EEE, dd MMM yyyy HH:mm:ss zzz", Locale.ENGLISH);

    @Override public String    name()      { return "WeWorkRemotely"; }
    @Override public boolean   hasBudget() { return true; }

    @Override
    public List<Job> fetch(UserProfile profile) {
        List<Job> out = new ArrayList<>();
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);

            Document doc;
            try (InputStream is = URI.create(FEED_URL).toURL().openStream()) {
                doc = factory.newDocumentBuilder().parse(is);
            }

            NodeList items = doc.getElementsByTagName("item");
            for (int i = 0; i < items.getLength() && out.size() < 50; i++) {
                Element el    = (Element) items.item(i);
                String  title = text(el, "title");         // e.g. "Acme: Senior Engineer"
                String  link  = text(el, "link");
                String  desc  = HTML_TAG.matcher(text(el, "description")).replaceAll("").trim();
                String  pub   = text(el, "pubDate");

                // Title format: "Company: Job Title" — split on first ":"
                String company = "Unknown";
                String jobTitle = title;
                int colon = title.indexOf(':');
                if (colon > 0) {
                    company  = title.substring(0, colon).trim();
                    jobTitle = title.substring(colon + 1).trim();
                }

                Instant postedAt = Instant.now();
                if (!pub.isBlank()) {
                    try { postedAt = Instant.from(RSS_DATE.parse(pub)); }
                    catch (DateTimeParseException ignored) {}
                }

                Job j = Job.builder()
                        .id(UUID.randomUUID())
                        .title(jobTitle)
                        .company(company)
                        .location("Remote")
                        .description(desc)
                        .sourceUrl(link)
                        .sourceName(name())
                        .currency("USD")
                        .postedAt(postedAt)
                        .build();
                j.setFingerprint(FingerprintUtil.of(j.getCompany(), j.getTitle(), j.getLocation()));
                out.add(j);
            }
            log.info("{} fetched {} jobs", name(), out.size());
        } catch (Exception e) {
            log.warn("{} fetch failed: {}", name(), e.getMessage());
        }
        return out;
    }

    private static String text(Element el, String tag) {
        NodeList nl = el.getElementsByTagName(tag);
        return nl.getLength() > 0 ? nl.item(0).getTextContent().trim() : "";
    }
}
