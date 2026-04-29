package com.careerops.service.sources;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Light-touch scraper for a few well-known career pages. Sites change layouts
 * often, so each parser is best-effort and fails closed.
 */
@Component
public class JsoupCompanySource implements JobSource {
    private static final Logger log = LoggerFactory.getLogger(JsoupCompanySource.class);

    private static final Map<String, String> CAREER_PAGES = Map.of(
        "Stripe", "https://stripe.com/jobs/search?query=engineer&office=dublin",
        "HubSpot", "https://www.hubspot.com/careers/jobs?location=dublin",
        "Workday", "https://www.workday.com/en-us/company/careers.html"
    );

    @Override public String name() { return "jsoup"; }

    @Override
    public List<Job> fetch(UserProfile profile) {
        List<Job> out = new ArrayList<>();
        for (var e : CAREER_PAGES.entrySet()) {
            try {
                Document doc = Jsoup.connect(e.getValue())
                    .userAgent("Mozilla/5.0 CareerOpsBot/1.0")
                    .timeout(8000).get();
                for (Element a : doc.select("a[href*=jobs], a[href*=careers], a[href*=position]")) {
                    String t = a.text().trim();
                    if (t.isEmpty() || t.length() > 140) continue;
                    Job j = Job.builder()
                        .title(t).company(e.getKey()).location("Dublin")
                        .sourceUrl(a.absUrl("href")).sourceName(e.getKey() + " careers")
                        .currency("EUR").postedAt(Instant.now()).build();
                    j.setFingerprint(FingerprintUtil.of(j.getCompany(), j.getTitle(), j.getLocation()));
                    out.add(j);
                    if (out.size() >= 30) break;
                }
            } catch (Exception ex) { log.warn("Jsoup {} failed: {}", e.getKey(), ex.getMessage()); }
        }
        return out;
    }
}
