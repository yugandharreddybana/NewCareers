package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class JobDeliveryFiltersTest {

    @Test
    void filterByMaxAge_keepsRecent_dropsStale() {
        Job fresh = job("Fresh", "Dublin", Instant.now().minus(13, ChronoUnit.DAYS));
        Job stale = job("Stale", "Dublin", Instant.now().minus(15, ChronoUnit.DAYS));
        Job unknown = job("Unknown", "Dublin", null);

        List<Job> out = JobDeliveryFilters.filterByMaxAge(List.of(fresh, stale, unknown), 14);

        assertThat(out).extracting(Job::getTitle).containsExactly("Fresh", "Unknown");
    }

    @Test
    void filterByIrelandOrRemote_keepsIrelandAndRemote_dropsUk() {
        Job dublin = job("Dublin role", "Dublin, Ireland", Instant.now());
        Job remote = job("Remote", "Remote - EU", Instant.now());
        Job london = job("London", "London, UK", Instant.now());
        Job blank = job("Blank", "", Instant.now());

        List<Job> out = JobDeliveryFilters.filterByIrelandOrRemote(List.of(dublin, remote, london, blank));

        assertThat(out).extracting(Job::getTitle)
                .containsExactly("Dublin role", "Remote", "Blank");
    }

    @Test
    void isIrelandOrRemote_detectsHints() {
        assertThat(JobDeliveryFilters.isIrelandOrRemote("Hybrid in Cork")).isTrue();
        assertThat(JobDeliveryFilters.isIrelandOrRemote("Manchester, England")).isFalse();
    }

    @Test
    void filterPlausibleJobTitles_rejectsLocaleHubLabels() {
        Job deutsch = job("Deutsch", "Dublin", Instant.now());
        Job engineer = job("Senior Software Engineer", "Dublin", Instant.now());

        List<Job> out = JobDeliveryFilters.filterPlausibleJobTitles(List.of(deutsch, engineer));

        assertThat(out).extracting(Job::getTitle).containsExactly("Senior Software Engineer");
    }

    @Test
    void titleMatchesDesiredRoles_strictForFullStackDeveloper() {
        UserProfile profile = new UserProfile();
        profile.setTargetRoles(new String[] { "Full Stack Developer" });

        assertThat(JobDeliveryFilters.titleMatchesDesiredRoles(profile, "Senior Full Stack Developer")).isTrue();
        assertThat(JobDeliveryFilters.titleMatchesDesiredRoles(profile, "Full Stack Engineer")).isTrue();
        assertThat(JobDeliveryFilters.titleMatchesDesiredRoles(profile, "Software Engineer")).isTrue();
        assertThat(JobDeliveryFilters.titleMatchesDesiredRoles(profile, "Account Executive")).isFalse();
        assertThat(JobDeliveryFilters.titleMatchesDesiredRoles(profile, "Account Executive, AI Sales")).isFalse();
    }

    @Test
    void titleMatchesDesiredRoles_requiresAllRoleTokens() {
        UserProfile profile = new UserProfile();
        profile.setTargetRoles(new String[] { "Software Engineer" });

        assertThat(JobDeliveryFilters.titleMatchesDesiredRoles(profile, "Senior Software Engineer")).isTrue();
        assertThat(JobDeliveryFilters.titleMatchesDesiredRoles(profile, "Software Developer")).isTrue();
        assertThat(JobDeliveryFilters.titleMatchesDesiredRoles(profile, "Account Opening")).isFalse();
        assertThat(JobDeliveryFilters.titleMatchesDesiredRoles(profile, "Executive Assistant")).isFalse();
    }

    @Test
    void filterByDesiredRoles_dropsSalesAndBankingTitles() {
        UserProfile profile = new UserProfile();
        profile.setTargetRoles(new String[] { "Full Stack Developer" });

        List<Job> out = JobDeliveryFilters.filterByDesiredRoles(
                List.of(
                        job("Account Executive", "Dublin", Instant.now()),
                        job("Account Executive, AI Sales", "Dublin", Instant.now()),
                        job("Senior Full Stack Developer", "Dublin", Instant.now()),
                        job("Software Engineer", "Dublin", Instant.now())),
                profile);

        assertThat(out).extracting(Job::getTitle)
                .containsExactly("Senior Full Stack Developer", "Software Engineer");
    }

    private static Job job(String title, String location, Instant postedAt) {
        Job j = new Job();
        j.setTitle(title);
        j.setCompany("Co");
        j.setLocation(location);
        j.setPostedAt(postedAt);
        return j;
    }
}
