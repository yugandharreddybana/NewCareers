package com.careerops.service.sources;

import com.careerops.model.Job;
import com.careerops.model.JobListing;
import com.careerops.model.UserProfile;
import com.careerops.service.JobProfileSearchTerms;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

final class JobListingMapper {

    private JobListingMapper() {}

    /**
     * Primary search keyword passed to board APIs as {@code what} / RSS query text.
     * Uses the first non-blank target role from onboarding/settings.
     */
    static String profileKeyword(UserProfile profile) {
        return JobProfileSearchTerms.primaryKeyword(profile);
    }

    static List<Job> toJobs(List<JobListing> listings) {
        if (listings == null || listings.isEmpty()) return List.of();
        List<Job> out = new ArrayList<>(listings.size());
        for (JobListing listing : listings) {
            Job job = toJob(listing);
            if (job != null) out.add(job);
        }
        return out;
    }

    static Job toJob(JobListing listing) {
        if (listing == null || listing.getTitle() == null || listing.getCompany() == null) {
            return null;
        }
        String url = listing.getUrl() != null ? listing.getUrl() : "";
        String fp = FingerprintUtil.fingerprint(
                listing.getTitle(),
                listing.getCompany(),
                url);
        return Job.builder()
                .title(listing.getTitle())
                .company(listing.getCompany())
                .location(listing.getLocation())
                .description(listing.getDescription())
                .sourceUrl(url)
                .sourceName(listing.getSource())
                .postedAt(listing.getPostedAt() != null ? listing.getPostedAt() : Instant.now())
                .fingerprint(fp)
                .build();
    }
}
