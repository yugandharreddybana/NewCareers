package com.careerops.service.sources;

import com.careerops.model.JobListing;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

@Component
public class LinkedInPublicSource implements JobSource {

    private static final Logger log = LoggerFactory.getLogger(LinkedInPublicSource.class);

    @Override public String name() { return "LinkedIn"; }

    @Override
    public List<JobListing> fetch(String keyword, String location, int maxAgeDays) {
        List<JobListing> results = new ArrayList<>();
        try {
            // LinkedIn public job search (no auth needed for listing page)
            String loc = location.isBlank() ? "Ireland" : location;
            String tpParam = maxAgeDays > 0 ? buildTimeParam(maxAgeDays) : "";
            String url = "https://www.linkedin.com/jobs/search/?keywords="
                    + URLEncoder.encode(keyword, StandardCharsets.UTF_8)
                    + "&location=" + URLEncoder.encode(loc, StandardCharsets.UTF_8)
                    + "&sortBy=DD" + tpParam;
            Document doc = Jsoup.connect(url)
                    .userAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36")
                    .header("Accept-Language", "en-US,en;q=0.9")
                    .timeout(20_000).get();
            Instant cutoff = maxAgeDays > 0 ? Instant.now().minus(maxAgeDays, ChronoUnit.DAYS) : null;
            Elements cards = doc.select("div.base-card");
            for (Element card : cards) {
                try {
                    String title   = card.select("h3.base-search-card__title").text();
                    String company = card.select("h4.base-search-card__subtitle").text();
                    String locStr  = card.select("span.job-search-card__location").text();
                    String link    = card.select("a.base-card__full-link").attr("abs:href");
                    String timeAgo = card.select("time").attr("datetime");
                    Instant posted = null;
                    if (!timeAgo.isBlank()) {
                        try { posted = Instant.parse(timeAgo + "T00:00:00Z"); } catch (Exception ignored) {}
                    }
                    if (cutoff != null && posted != null && posted.isBefore(cutoff)) continue;
                    JobListing j = new JobListing();
                    j.setTitle(title); j.setCompany(company); j.setLocation(locStr);
                    j.setUrl(link); j.setSource(name()); j.setPostedAt(posted);
                    results.add(j);
                } catch (Exception e) { log.debug("LinkedIn card parse", e); }
            }
        } catch (Exception e) { log.warn("LinkedIn fetch failed: {}", e.getMessage()); }
        return results;
    }

    private String buildTimeParam(int maxAgeDays) {
        if (maxAgeDays <= 1)  return "&f_TPR=r86400";
        if (maxAgeDays <= 7)  return "&f_TPR=r604800";
        if (maxAgeDays <= 14) return "&f_TPR=r1209600";
        return "&f_TPR=r2592000";
    }
}
