package com.careerops.service;

import com.careerops.dto.ProfileDtos.ProfileRequest;
import com.careerops.model.User;
import com.careerops.model.UserProfile;
import com.careerops.model.UserProfile.EducationEntry;
import com.careerops.model.UserProfile.WorkExperienceEntry;
import com.careerops.repository.UserCvRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProfileOnboardingPersistenceTest {

    @Mock UserProfileRepository profiles;
    @Mock UserCvRepository cvs;
    @Mock UserJobRepository userJobs;
    @Mock UserRepository users;
    @Mock AuditLogService audit;
    @Mock CvService cvService;
    @Mock CvSkillExtractionService skillExtraction;

    ProfileService profileService;

    UUID userId = UUID.randomUUID();
    UserProfile profile;
    User user;

    @BeforeEach
    void setUp() {
        profileService = new ProfileService(profiles, cvs, userJobs, users, audit, cvService, skillExtraction);
        when(skillExtraction.extractForUser(any(), any(), any())).thenReturn(List.of());
        profile = UserProfile.builder()
            .userId(userId)
            .onboarded(false)
            .build();
        user = User.builder().id(userId).name("Old Name").email("a@b.com").username("ab").passwordHash("x").build();
        when(profiles.findByUserId(userId)).thenReturn(Optional.of(profile));
        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(cvs.findFirstByUserIdAndIsActiveTrueOrderByUploadedAtDesc(userId)).thenReturn(Optional.empty());
        when(profiles.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(users.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void upsert_persistsOnboardingFieldsAndCompletesOnboarding() {
        var work = List.of(WorkExperienceEntry.builder()
            .jobTitle("Engineer")
            .companyName("Acme")
            .startDate("2020-01")
            .current(true)
            .description("Built APIs")
            .build());
        var edu = List.of(EducationEntry.builder()
            .schoolName("State U")
            .degree("bachelors")
            .fieldOfStudy("CS")
            .graduationYear("2020")
            .build());

        var req = new ProfileRequest(
            "Jane Doe",
            new String[] { "Full Stack Developer" },
            new String[] { "React", "Java" },
            "Dublin, Ireland",
            60_000,
            120_000,
            "EUR",
            new String[] { "Full-time" },
            null,
            null,
            true,
            true,
            "Senior Engineer",
            null,
            null,
            null,
            true,
            "senior",
            work,
            edu,
            "Hybrid",
            "2 Days per week",
            "2 weeks notice"
        );

        var response = profileService.upsert(userId, req, null);

        assertThat(user.getName()).isEqualTo("Jane Doe");
        assertThat(profile.getGoalTitle()).isEqualTo("Senior Engineer");
        assertThat(profile.getTargetRoles()).containsExactly("Full Stack Developer");
        assertThat(profile.getTechStack()).containsExactly("React", "Java");
        assertThat(profile.getExperienceLevel()).isEqualTo("senior");
        assertThat(profile.getWorkExperience()).hasSize(1);
        assertThat(profile.getEducation()).hasSize(1);
        assertThat(profile.getSalaryMin()).isEqualTo(60_000);
        assertThat(profile.getSalaryMax()).isEqualTo(120_000);
        assertThat(profile.getSalaryCurrency()).isEqualTo("EUR");
        assertThat(profile.getSectors()).containsExactly("Full-time");
        assertThat(profile.getAvailability()).isEqualTo("2 weeks notice");
        assertThat(profile.getRemotePolicy()).isEqualTo("Hybrid");
        assertThat(profile.getHybridOnsiteDays()).isEqualTo("2 Days per week");
        assertThat(profile.getOnboarded()).isTrue();
        assertThat(response.onboarded()).isTrue();
        verify(audit).log(userId, "ONBOARDING_COMPLETE", java.util.Map.of("targetRole", "Full Stack Developer"));
    }
}
