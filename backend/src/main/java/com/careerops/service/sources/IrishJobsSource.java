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
 * Scrapes IrishJobs.ie search results (StepStone unified result list).
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
                String slug = role.trim().toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
                String url = BASE + "/jobs/" + slug;
                log.debug("Fetching IrishJobs for role: {} → {}", role, url);
                String html = Jsoup.connect(url)
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
                    .timeout(20_000)
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
                        .sourceName("IrishJobs")
                        .currency("EUR")
                        .postedAt(Instant.now())
                        .build();
                    j.setFingerprint(FingerprintUtil.of(j.getCompany(), j.getTitle(), j.getLocation()));
                    out.add(j);
                    if (out.size() >= 40) {
                        return out;
                    }
                }
                log.info("IrishJobs fetched {} jobs for role '{}' ({} total)",
                    out.size() - before, role, out.size());
            } catch (Exception e) {
                log.warn("IrishJobs fetch failed for role '{}': {}", role, e.getMessage());
            }
        }
        return out;
    }

    /**
     * Extract company name from a URL slug like
     * /job/senior-software-engineer/google-ireland-ltd-job107389008
     */
    static String extractCompanyFromUrl(String url) {
        int lastSlash = url.lastIndexOf('/');
        if (lastSlash < 0) {
            return "Unknown";
        }

        String[] segments = url.substring(lastSlash + 1).split("/");
        String lastSegment = segments[segments.length - 1];
        lastSegment = lastSegment.replaceAll("-job\\d+$", "");

        if (lastSegment.isEmpty()) {
            return "Unknown";
        }

        String[] words = lastSegment.split("-");
        StringBuilder sb = new StringBuilder();
        for (String w : words) {
            if (w.isEmpty()) {
                continue;
            }
            if (!sb.isEmpty()) {
                sb.append(' ');
            }
            String upper = w.toUpperCase();
            if (upper.equals("LTD") || upper.equals("LLC") || upper.equals("PLC")
                || upper.equals("INC") || upper.equals("CORP") || upper.equals("GMBH")
                || upper.equals("AWS") || upper.equals("AI") || upper.equals("IT")
                || upper.equals("UK") || upper.equals("USA") || upper.equals("HR")) {
                sb.append(upper);
            } else if (w.length() <= 3) {
                sb.append(upper);
            } else {
                sb.append(Character.toUpperCase(w.charAt(0)));
                sb.append(w.substring(1).toLowerCase());
            }
        }
        String result = sb.toString().trim();
        return result.isEmpty() ? "Unknown" : result;
    }
}
