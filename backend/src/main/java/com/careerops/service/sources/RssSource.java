package com.careerops.service.sources;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.rometools.rome.feed.synd.SyndEntry;
import com.rometools.rome.feed.synd.SyndFeed;
import com.rometools.rome.io.SyndFeedInput;
import com.rometools.rome.io.XmlReader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.net.URL;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Component
public class RssSource implements JobSource {
    private static final Logger log = LoggerFactory.getLogger(RssSource.class);

    /** Legacy RSS endpoints — often 403/404; Irish boards use Stepstone HTML parsers instead. */
    private static final String[] FEEDS = new String[] {};

    @Override public String name() { return "rss"; }

    @Override
    public List<Job> fetch(UserProfile profile) {
        List<Job> out = new ArrayList<>();
        SyndFeedInput input = new SyndFeedInput();
        for (String feed : FEEDS) {
            try {
                URL url = java.net.URI.create(feed).toURL();
                try (XmlReader r = new XmlReader(url.openStream())) {
                    SyndFeed f = input.build(r);
                for (SyndEntry e : f.getEntries()) {
                    String title   = e.getTitle() == null ? "Untitled" : e.getTitle();
                    String desc    = e.getDescription() == null ? "" : e.getDescription().getValue();
                    String company = extractCompany(title);
                    Job j = Job.builder()
                        .title(stripCompany(title))
                        .company(company)
                        .location("Ireland")
                        .description(desc)
                        .sourceUrl(e.getLink())
                        .sourceName(feed.contains("indeed") ? "Indeed IE" :
                                    feed.contains("jobs.ie") ? "Jobs.ie" : "IrishJobs")
                        .currency("EUR")
                        .postedAt(e.getPublishedDate() != null
                            ? e.getPublishedDate().toInstant() : Instant.now())
                        .build();
                    j.setFingerprint(FingerprintUtil.of(j.getCompany(), j.getTitle(), j.getLocation()));
                    out.add(j);
                }
                }
            } catch (Exception e) {
                log.warn("RSS feed failed {}: {}", feed, e.getMessage());
            }
        }
        return out;
    }

    private static String extractCompany(String title) {
        if (title == null) return "Unknown";
        int at = title.toLowerCase().indexOf(" at ");
        if (at > 0 && at + 4 < title.length()) {
            String c    = title.substring(at + 4).trim();
            int    dash = c.indexOf(" - ");
            return (dash > 0 ? c.substring(0, dash) : c).trim();
        }
        return "Unknown";
    }

    private static String stripCompany(String title) {
        if (title == null) return "Untitled";
        int at = title.toLowerCase().indexOf(" at ");
        return at > 0 ? title.substring(0, at).trim() : title;
    }
}
