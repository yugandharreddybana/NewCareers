package com.careerops.service.sources;

import com.careerops.dto.SearchParams;
import com.careerops.model.Job;
import com.careerops.model.JobListing;
import com.careerops.model.UserProfile;
import com.careerops.service.JobFetchSettings;
import com.careerops.service.JobProfileSearchTerms;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Contract for job-board scrapers. Keyword fetch returns {@link JobListing};
 * profile-driven delivery uses {@link #fetch(UserProfile)} (default maps keyword scrape to {@link Job}).
 */
public interface JobSource {

    String name();

    default String sourceName() {
        return name();
    }

    default List<JobListing> fetch(String keyword, String location, int maxAgeDays) {
        return List.of();
    }

    default List<Job> fetch(UserProfile profile) {
        if (profile == null) return List.of();
        String location = JobFetchSettings.staticDeliveryLocation();
        int maxAgeDays = JobFetchSettings.staticMaxAgeDays();
        Map<String, JobListing> byUrl = new LinkedHashMap<>();
        for (String keyword : JobProfileSearchTerms.searchKeywords(profile)) {
            for (JobListing listing : fetch(keyword, location, maxAgeDays)) {
                if (listing == null) continue;
                String url = listing.getUrl() != null ? listing.getUrl() : "";
                String key = url.isBlank()
                        ? (listing.getTitle() + "|" + listing.getCompany())
                        : JobPostingFingerprint.canonicalPostingUrl(url);
                byUrl.putIfAbsent(key, listing);
            }
        }
        return JobListingMapper.toJobs(new ArrayList<>(byUrl.values()));
    }

    default boolean isEnabled() {
        return hasBudget();
    }

    default boolean hasBudget() {
        return true;
    }

    default List<Job> search(SearchParams params, UserProfile profile) {
        return List.of();
    }
}
