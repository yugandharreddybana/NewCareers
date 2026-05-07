package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class JobMatchingServiceTest {

    @org.mockito.Mock
    private java.time.Clock clock;

    @InjectMocks
    private JobMatchingService service;

    @Test
    @DisplayName("topN — exact tech overlap filters and returns top jobs")
    void topN_exactOverlapGivesHighScore() {
        UserProfile profile = new UserProfile();
        profile.setTechStack(new String[]{"React", "TypeScript", "Node.js"});
        profile.setTargetRoles(new String[]{"Frontend Engineer"});

        Job job1 = Job.builder()
                .title("Senior Frontend Engineer")
                .description("React, TypeScript, Node.js developer needed")
                .location("Ireland")
                .build();
        Job job2 = Job.builder()
                .title("Backend Java")
                .description("Java Spring developer")
                .location("USA")
                .build();

        List<JobMatchingService.ScoredJob> matches = service.topN(List.of(job1, job2), profile, 5);

        assertThat(matches).hasSize(1);
        assertThat(matches.get(0).job().getTitle()).isEqualTo("Senior Frontend Engineer");
    }
}
