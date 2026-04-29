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
 * Scrapes IrishJobs.ie search results using Jsoup.
 * Searches each target role and collects up to 40 listings.
 */
@Component
public class IrishJobsSource implements JobSource {
    private static final Logger log = LoggerFactory.getLogger(IrishJobsSource.class);
    private static final String BASE = "https://www.irishjobs.ie";

    @Override public String name() { return "irishjobs"; }

    @Override
    public List<Job> fetch(UserProfile profile) {
        List<Job> out = new ArrayList<>();
        String[] roles = (profile.getTargetRoles() == null || profile.getTargetRoles().length == 0)
            ? new String[]{"software engineer", "full stack developer"}
            : profile.getTargetRoles();

        for (String role : Arrays.copyOf(roles, Math.min(roles.length, 3))) {
            try {
                String url = BASE + "/ShowResults.aspx?Keywords="
                    + role.replace(" ", "+") + "&Location=1&Recruiter=Company&SortType=date";
                Document doc = Jsoup.connect(url)
                    .userAgent("Mozilla/5.0 (compatible; CareerOpsBot/1.0)")
                    .timeout(10_000).get();

                Elements listings = doc.select("div.job_item, li.jobsearch-result, div[class*=job-listing]");
                if (listings.isEmpty()) listings = doc.select("a[href*=/job/], a[href*=/jobs/]");

                for (Element el : listings) {
                    Element titleEl = el.select("a[class*=job], h2, h3").first();
                    String title = titleEl != null ? titleEl.text().trim() : el.text().trim();
                    String company = el.select("[class*=company], [class*=employer]").text().trim();
                    String location = el.select("[class*=location], [class*=place]").text().trim();
                    String href = el.select("a[href]").attr("abs:href");

                    if (title.isEmpty() || title.length() > 150) continue;
                    if (company.isEmpty()) company = "Unknown";
                    if (location.isEmpty()) location = "Ireland";

                    Job j = Job.builder()
                        .title(title).company(company).location(location)
                        .sourceUrl(href.isEmpty() ? url : href)
                        .sourceName("IrishJobs").currency("EUR")
                        .postedAt(Instant.now()).build();
                    j.setFingerprint(FingerprintUtil.of(j.getCompany(), j.getTitle(), j.getLocation()));
                    out.add(j);
                    if (out.size() >= 40) return out;
                }
            } catch (Exception e) {
                log.warn("IrishJobs fetch failed for role '{}': {}", role, e.getMessage());
            }
        }
        return out;
    }
}
