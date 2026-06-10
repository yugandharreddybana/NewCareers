package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.careerops.repository.JobRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CachedJobPoolServiceTest {

    @Mock JobRepository jobs;
    @Mock JobFetchSettings fetchSettings;

    private CachedJobPoolService pool;
    private final Instant now = Instant.parse("2026-06-08T10:00:00Z");

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(now, ZoneOffset.UTC);
        pool = new CachedJobPoolService(jobs, fetchSettings, clock);
        when(fetchSettings.maxAgeDays()).thenReturn(14);
    }

    @Test
    void loadCandidates_richProfile_filtersByRolesAndLocation() {
        UserProfile profile = richProfile();
        Job match = job("Full Stack Developer", "Acme", "Dublin, Ireland", "Build APIs with Java");
        Job wrongTitle = job("Account Executive", "SalesCo", "Dublin", "Quota");
        Job wrongLocation = job("Full Stack Developer", "RemoteCo", "London, UK", "Java APIs");

        when(jobs.findRecentByScrapedAtAfter(any(Instant.class), any(Pageable.class)))
            .thenReturn(List.of(match, wrongTitle, wrongLocation));

        List<Job> result = pool.loadCandidates(profile, 500);

        assertThat(result).containsExactly(match);
    }

    @Test
    void loadCandidates_sparseProfile_usesFallbackKeyword() {
        UserProfile profile = new UserProfile();
        profile.setUserId(UUID.randomUUID());
        profile.setLocation("Ireland");
        profile.setOpenToRemote(true);

        Job engineer = job("Software Engineer", "TechCo", "Remote", "Backend services");
        Job unrelated = job("Marketing Manager", "AdCo", "Dublin", "Campaigns");

        when(jobs.findRecentByScrapedAtAfter(any(Instant.class), any(Pageable.class)))
            .thenReturn(List.of(engineer, unrelated));

        List<Job> result = pool.loadCandidates(profile, 500);

        assertThat(result).containsExactly(engineer);
    }

    @Test
    void loadCandidates_respectsFetchCap() {
        UserProfile profile = richProfile();
        when(jobs.findRecentByScrapedAtAfter(any(Instant.class), any(Pageable.class)))
            .thenReturn(List.of(job("Full Stack Developer", "A", "Dublin", "Java")));

        pool.loadCandidates(profile, 100);

        ArgumentCaptor<Pageable> page = ArgumentCaptor.forClass(Pageable.class);
        verify(jobs).findRecentByScrapedAtAfter(any(Instant.class), page.capture());
        assertThat(page.getValue().getPageSize()).isEqualTo(100);
    }

    @Test
    void filterByKeywords_matchesTitleOrDescription() {
        Job byTitle = job("Backend Engineer", "Co", "Dublin", "misc");
        Job byDesc = job("Developer", "Co", "Dublin", "software engineer role");
        Job miss = job("Chef", "Co", "Dublin", "kitchen");

        List<Job> matched = CachedJobPoolService.filterByKeywords(
            List.of(byTitle, byDesc, miss),
            List.of("software engineer"));

        assertThat(matched).containsExactly(byDesc);
    }

    private UserProfile richProfile() {
        UserProfile profile = new UserProfile();
        profile.setUserId(UUID.randomUUID());
        profile.setTargetRoles(new String[] {"Full Stack Developer"});
        profile.setLocation("Dublin");
        profile.setOpenToRemote(true);
        return profile;
    }

    private Job job(String title, String company, String location, String description) {
        Job j = new Job();
        j.setId(UUID.randomUUID());
        j.setFingerprint(UUID.randomUUID().toString());
        j.setTitle(title);
        j.setCompany(company);
        j.setLocation(location);
        j.setDescription(description);
        j.setScrapedAt(now.minusSeconds(3600));
        j.setPostedAt(now.minusSeconds(7200));
        return j;
    }
}
