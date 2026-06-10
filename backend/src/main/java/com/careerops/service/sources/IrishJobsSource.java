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
import java.util.Set;

@Component
public class IrishJobsSource implements JobSource {

    private static final Logger log = LoggerFactory.getLogger(IrishJobsSource.class);
    private static final String BASE = "https://www.irishjobs.ie/Jobs/";
    private static final Set<String> COMPANY_ACRONYMS = Set.of(
        "aib", "aws", "bny", "cpl", "dhl", "esb", "ibm", "ict", "idc", "kbc",
        "ltd", "mcs", "ntt", "pwc", "rte", "sse", "tsb", "ubs"
    );

    @Override public String name() { return "IrishJobs"; }

    @Override
    public List<JobListing> fetch(String keyword, String location, int maxAgeDays) {
        List<JobListing> results = new ArrayList<>();
        try {
            String url = BASE + URLEncoder.encode(keyword.replace(" ", "-"), StandardCharsets.UTF_8)
                    + "?radius=50&sf=26";
            Document doc = Jsoup.connect(url)
                    .userAgent("Mozilla/5.0 (compatible; CareerOps/1.0)")
                    .timeout(15_000).get();
            Instant cutoff = maxAgeDays > 0 ? Instant.now().minus(maxAgeDays, ChronoUnit.DAYS) : null;
            Elements cards = doc.select("div.job-item");
            for (Element card : cards) {
                try {
                    String title   = card.select("h2 a").text();
                    String company = card.select("span.company-link").text();
                    String loc     = card.select("li.location").text();
                    String link    = card.select("h2 a").attr("abs:href");
                    String dateStr = card.select("li.date-added").text();
                    Instant posted = FingerprintUtil.parseRelativeDate(dateStr);
                    if (cutoff != null && posted != null && posted.isBefore(cutoff)) continue;
                    JobListing j = new JobListing();
                    j.setTitle(title); j.setCompany(company); j.setLocation(loc);
                    j.setUrl(link); j.setSource(name());
                    j.setPostedAt(posted);
                    results.add(j);
                } catch (Exception e) { log.debug("IrishJobs card parse error", e); }
            }
        } catch (Exception e) { log.warn("IrishJobs fetch failed: {}", e.getMessage()); }
        return results;
    }

    /** Parses company slug from IrishJobs job URL path (see {@link IrishJobsSourceTest}). */
    public static String extractCompanyFromUrl(String path) {
        if (path == null || path.isBlank()) return "Unknown";
        String[] parts = path.split("/");
        if (parts.length < 4) return "Unknown";
        String slug = parts[parts.length - 1];
        if (slug.startsWith("job") && parts.length >= 3) {
            slug = parts[parts.length - 2];
        }
        if (slug.isBlank() || slug.startsWith("job")) return "Unknown";
        String[] words = slug.split("-");
        StringBuilder sb = new StringBuilder();
        for (String w : words) {
            if (w.isBlank() || w.equals("job") || w.matches("job\\d+")) continue;
            if (!sb.isEmpty()) sb.append(' ');
            sb.append(formatCompanyWord(w));
        }
        return sb.isEmpty() ? "Unknown" : sb.toString();
    }

    private static String formatCompanyWord(String word) {
        String lower = word.toLowerCase();
        if (COMPANY_ACRONYMS.contains(lower)) {
            return lower.toUpperCase();
        }
        return Character.toUpperCase(lower.charAt(0)) + lower.substring(1);
    }
}
