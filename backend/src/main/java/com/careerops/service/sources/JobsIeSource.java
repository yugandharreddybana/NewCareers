package com.careerops.service.sources;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Scrapes Jobs.ie search results using Jsoup.
 * Searches each target role sorted by date and collects up to 40 listings.
 */
@Component
public class JobsIeSource implements JobSource {
    private static final Logger log = LoggerFactory.getLogger(JobsIeSource.class);
    private static final String BASE = "https://www.jobs.ie";

    @Override public String name() { return "jobsie"; }

    @Override
    public List<Job> fetch(UserProfile profile) {
        List<Job> out = new ArrayList<>();
        String[] roles = (profile.getTargetRoles() == null || profile.getTargetRoles().length == 0)
            ? new String[]{"software developer", "full stack developer"}
            : profile.getTargetRoles();

        for (String role : Arrays.copyOf(roles, Math.min(roles.length, 3))) {
            try {
                String url = BASE + "/jobs/it-software/?q=" + role.replace(" ", "+") + "&sort=date";
                Document doc = Jsoup.connect(url)
                    .userAgent("Mozilla/5.0 (compatible; CareerOpsBot/1.0)")
                    .timeout(10_000).get();

                Elements listings = doc.select("article.job, div[class*=job-result], li[class*=job]");
                if (listings.isEmpty()) listings = doc.select("h2 > a[href*=/job], h3 > a[href*=/job]");

                for (Element el : listings) {
                    Element titleEl = el.select("h2 a, h3 a, a[class*=title]").first();
                    if (titleEl == null) continue;
                    String title   = titleEl.text().trim();
                    String company = el.select("[class*=company],[class*=employer]").text().trim();
                    String location= el.select("[class*=location],[class*=place]").text().trim();
                    String href    = titleEl.absUrl("href");

                    if (title.isEmpty() || title.length() > 150) continue;
                    if (company.isEmpty())  company  = "Unknown";
                    if (location.isEmpty()) location = "Ireland";

                    Job j = Job.builder()
                        .title(title).company(company).location(location)
                        .sourceUrl(href.isEmpty() ? url : href)
                        .sourceName("Jobs.ie").currency("EUR")
                        .postedAt(Instant.now()).build();
                    j.setFingerprint(FingerprintUtil.of(j.getCompany(), j.getTitle(), j.getLocation()));
                    out.add(j);
                    if (out.size() >= 40) return out;
                }
            } catch (Exception e) {
                log.warn("Jobs.ie fetch failed for role '{}': {}", role, e.getMessage());
            }
        }
        return out;
    }
}
