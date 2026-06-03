package com.careerops.service.sources;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import org.jsoup.Jsoup;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Scrapes Jobs.ie search results (StepStone unified result list).
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
                String html = Jsoup.connect(url)
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
                    .timeout(20_000)
                    .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                    .header("Accept-Language", "en-IE,en;q=0.9")
                    .ignoreContentType(true)
                    .execute().body();

                int before = out.size();
                for (StepstonePreloadedParser.Listing listing : StepstonePreloadedParser.parse(html, BASE)) {
                    String company = listing.company().isBlank() ? "Unknown" : listing.company();
                    String location = listing.location().isBlank() ? "Ireland" : listing.location();
                    Job j = Job.builder()
                        .title(listing.title())
                        .company(company)
                        .location(location)
                        .sourceUrl(StepstonePreloadedParser.toAbsoluteUrl(BASE, listing.relativeUrl()))
                        .sourceName("Jobs.ie")
                        .currency("EUR")
                        .postedAt(Instant.now())
                        .build();
                    j.setFingerprint(FingerprintUtil.of(j.getCompany(), j.getTitle(), j.getLocation()));
                    out.add(j);
                    if (out.size() >= 40) {
                        return out;
                    }
                }
                log.info("Jobs.ie fetched {} jobs for role '{}' ({} total)",
                    out.size() - before, role, out.size());
            } catch (Exception e) {
                log.warn("Jobs.ie fetch failed for role '{}': {}", role, e.getMessage());
            }
        }
        return out;
    }
}
