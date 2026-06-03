package com.careerops.service.sources.company;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.careerops.service.JobMatchingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CompanyCareerSourceTest {

    @Mock CompanyCareerRegistry registry;
    @Mock CompanyCareerFetcher fetcher;
    @Mock CompanyCareerCacheService cache;
    @Mock JobMatchingService matcher;

    private CompanyCareerSource source;

    @BeforeEach
    void setUp() {
        source = new CompanyCareerSource(registry, fetcher, cache, matcher);
    }

    @Test
    void name_isJsoupCompaniesForUiBadge() {
        assertThat(source.name()).isEqualTo("jsoup-companies");
    }

    @Test
    void fetchProfileMatches_returnsBestPerCompanyFromCache() {
        UserProfile profile = UserProfile.builder().userId(UUID.randomUUID()).build();
        Job ey = job("EY", "Audit Associate");
        Job intercom = job("Intercom", "Software Engineer");
        when(cache.loadFreshJobs()).thenReturn(List.of(ey, intercom));
        when(matcher.topN(anyList(), eq(profile), eq(1)))
            .thenAnswer(inv -> {
                List<Job> jobs = inv.getArgument(0);
                Job j = jobs.get(0);
                return List.of(new JobMatchingService.ScoredJob(j, 80, List.of(), List.of()));
            });

        List<Job> out = source.fetchProfileMatches(profile, 0);
        assertThat(out).hasSize(2);
        assertThat(out).extracting(Job::getCompany).containsExactlyInAnyOrder("EY", "Intercom");
    }

    private static Job job(String company, String title) {
        Job j = Job.builder()
            .title(title)
            .company(company)
            .location("Dublin, Ireland")
            .sourceName(CompanyCareerSource.SOURCE_NAME)
            .postedAt(Instant.now())
            .build();
        j.setFingerprint(company + "-" + title);
        return j;
    }
}
