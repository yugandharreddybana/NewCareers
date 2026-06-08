package com.careerops.service;

import com.careerops.repository.ApplicationCvRepository;
import com.careerops.repository.ApplicationRunRepository;
import com.careerops.repository.OrgMemberRepository;
import com.careerops.repository.ResumeVersionRepository;
import com.careerops.repository.SkillRunRepository;
import com.careerops.repository.UserCvRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrgUsageCounterTest {

    @Mock SkillRunRepository skillRunRepo;
    @Mock ApplicationRunRepository applicationRunRepo;
    @Mock UserCvRepository userCvRepo;
    @Mock ApplicationCvRepository applicationCvRepo;
    @Mock ResumeVersionRepository resumeVersionRepo;
    @Mock OrgMemberRepository orgMemberRepo;

    OrgUsageCounter counter;
    UUID orgId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        counter = new OrgUsageCounter(
                skillRunRepo,
                applicationRunRepo,
                userCvRepo,
                applicationCvRepo,
                resumeVersionRepo,
                orgMemberRepo);
    }

    @Test
    @DisplayName("cvUploadsTotal sums profile, kanban, and resume-version file uploads")
    void cvUploadsTotalAggregatesAllSources() {
        when(userCvRepo.countByOrgId(orgId)).thenReturn(2L);
        when(applicationCvRepo.countByOrgId(orgId)).thenReturn(3L);
        when(resumeVersionRepo.countWithFileByOrgId(orgId)).thenReturn(1L);

        assertThat(counter.cvUploadsTotal(orgId)).isEqualTo(6L);
    }
}
