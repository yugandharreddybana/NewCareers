package com.careerops.service.sources;

import com.careerops.model.JobListing;
import java.util.List;

/**
 * Contract for every job-board scraper / API adapter.
 * maxAgeDays – only return jobs posted within this many days (0 = no filter).
 */
public interface JobSource {
    String sourceName();
    List<JobListing> fetch(String keyword, String location, int maxAgeDays);
    default boolean isEnabled() { return true; }
}
