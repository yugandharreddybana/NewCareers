package com.careerops.service.sources;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration test — makes real HTTP calls to IrishJobs.ie.
 * Verifies the Jsoup selectors still match the live site structure.
 */
class IrishJobsSourceIT {

    private final IrishJobsSource source = new IrishJobsSource();

    @Test
    @DisplayName("fetch returns jobs from the live IrishJobs.ie site")
    void fetch_returnsRealJobs() {
        UserProfile profile = new UserProfile();
        profile.setTargetRoles(new String[]{"software engineer"});

        List<Job> jobs = source.fetch(profile);

        assertThat(jobs)
            .as("Should return some jobs from IrishJobs.ie")
            .isNotEmpty();

        // Verify each job has required fields
        for (Job job : jobs) {
            assertThat(job.getTitle())
                .as("Job should have a title")
                .isNotBlank();
            assertThat(job.getSourceName())
                .as("Source should be IrishJobs")
                .isEqualTo("IrishJobs");
            assertThat(job.getFingerprint())
                .as("Job should have a fingerprint")
                .isNotBlank();
            assertThat(job.getSourceUrl())
                .as("Job should have a source URL")
                .isNotBlank();
        }

        assertThat(jobs.size())
            .as("Should return at most 40 jobs")
            .isLessThanOrEqualTo(40);

        System.out.println("=== IrishJobs.ie fetch result ===");
        System.out.println("Jobs found: " + jobs.size());
        for (int i = 0; i < Math.min(jobs.size(), 5); i++) {
            Job j = jobs.get(i);
            System.out.printf("  [%d] %s | %s | %s | %s%n",
                i + 1, j.getTitle(), j.getCompany(), j.getLocation(), j.getSourceUrl());
        }
    }

    @Test
    @DisplayName("fetch with fallback roles when no target roles set")
    void fetch_usesDefaultRoles_whenProfileHasNoRoles() {
        UserProfile profile = new UserProfile(); // no target roles

        List<Job> jobs = source.fetch(profile);

        // Even with zero-target-role profile, should fall back to defaults
        assertThat(jobs).isNotNull();
        // May be empty if site is down, but shouldn't throw
        System.out.println("Fallback fetch jobs: " + jobs.size());
    }
}
