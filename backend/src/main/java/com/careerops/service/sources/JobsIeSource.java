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
public class JobsIeSource implements JobSource {

    private static final Logger log = LoggerFactory.getLogger(JobsIeSource.class);
    private static final String BASE = "https://www.jobs.ie/job-search/";

    @Override public String name() { return "Jobs.ie"; }

    @Override
    public List<JobListing> fetch(String keyword, String location, int maxAgeDays) {
        List<JobListing> results = new ArrayList<>();
        try {
            String q = URLEncoder.encode(keyword, StandardCharsets.UTF_8);
            String url = BASE + "?q=" + q + "&l=ireland&sort=date";
            Document doc = Jsoup.connect(url)
                    .userAgent("Mozilla/5.0 (compatible; CareerOps/1.0)")
                    .timeout(15_000).get();
            Instant cutoff = maxAgeDays > 0 ? Instant.now().minus(maxAgeDays, ChronoUnit.DAYS) : null;
            Elements cards = doc.select("article.job-result");
            if (cards.isEmpty()) cards = doc.select("div.job-listing");
            for (Element card : cards) {
                try {
                    String title   = card.select("h2 a, h3 a, .job-title a").first() != null
                                     ? card.select("h2 a, h3 a, .job-title a").first().text() : "";
                    String company = card.select(".company, .employer").text();
                    String loc     = card.select(".location, .job-location").text();
                    String link    = card.select("a").first() != null
                                     ? card.select("a").first().attr("abs:href") : "";
                    String dateStr = card.select(".date, time").text();
                    Instant posted = FingerprintUtil.parseRelativeDate(dateStr);
                    if (cutoff != null && posted != null && posted.isBefore(cutoff)) continue;
                    if (title.isBlank()) continue;
                    JobListing j = new JobListing();
                    j.setTitle(title); j.setCompany(company); j.setLocation(loc);
                    j.setUrl(link); j.setSource(name()); j.setPostedAt(posted);
                    results.add(j);
                } catch (Exception e) { log.debug("Jobs.ie card parse", e); }
            }
        } catch (Exception e) { log.warn("Jobs.ie fetch failed: {}", e.getMessage()); }
        return results;
    }
}
