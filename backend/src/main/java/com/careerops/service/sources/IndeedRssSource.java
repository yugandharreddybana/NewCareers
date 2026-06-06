package com.careerops.service.sources;

import com.careerops.model.JobListing;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Component
public class IndeedRssSource implements JobSource {

    private static final Logger log = LoggerFactory.getLogger(IndeedRssSource.class);
    private static final DateTimeFormatter RFC822 =
            DateTimeFormatter.ofPattern("EEE, dd MMM yyyy HH:mm:ss Z", Locale.ENGLISH);

    @Override public String name() { return "Indeed"; }

    @Override
    public List<JobListing> fetch(String keyword, String location, int maxAgeDays) {
        List<JobListing> results = new ArrayList<>();
        try {
            String q = URLEncoder.encode(keyword, StandardCharsets.UTF_8);
            String l = URLEncoder.encode(location.isBlank() ? "Ireland" : location, StandardCharsets.UTF_8);
            String rssUrl = "https://ie.indeed.com/rss?q=" + q + "&l=" + l + "&sort=date";
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            DocumentBuilder builder = factory.newDocumentBuilder();
            Document doc = builder.parse(new URL(rssUrl).openStream());
            NodeList items = doc.getElementsByTagName("item");
            Instant cutoff = maxAgeDays > 0 ? Instant.now().minus(maxAgeDays, ChronoUnit.DAYS) : null;
            for (int i = 0; i < items.getLength(); i++) {
                try {
                    org.w3c.dom.Element item = (org.w3c.dom.Element) items.item(i);
                    String title   = getText(item, "title");
                    String link    = getText(item, "link");
                    String company = getText(item, "source");
                    String loc     = getText(item, "location");
                    String pubDate = getText(item, "pubDate");
                    Instant posted = null;
                    if (pubDate != null && !pubDate.isBlank()) {
                        try { posted = ZonedDateTime.parse(pubDate.trim(), RFC822).toInstant(); } catch (Exception ignored) {}
                    }
                    if (cutoff != null && posted != null && posted.isBefore(cutoff)) continue;
                    JobListing j = new JobListing();
                    j.setTitle(title); j.setCompany(company); j.setLocation(loc);
                    j.setUrl(link); j.setSource(name()); j.setPostedAt(posted);
                    results.add(j);
                } catch (Exception e) { log.debug("Indeed item parse", e); }
            }
        } catch (Exception e) { log.warn("Indeed RSS fetch failed: {}", e.getMessage()); }
        return results;
    }

    private String getText(org.w3c.dom.Element el, String tag) {
        NodeList nl = el.getElementsByTagName(tag);
        if (nl.getLength() == 0) return "";
        return nl.item(0).getTextContent();
    }
}
