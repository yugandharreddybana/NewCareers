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
import com.careerops.security.AesFieldEncryptor;
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
import static org.mockito.Mockito.lenient;
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
    @Mock AesFieldEncryptor fieldEncryptor;

    ProfileService profileService;

    UUID userId = UUID.randomUUID();
    UserProfile profile;
    User user;

    @BeforeEach
    void setUp() {
        profileService = new ProfileService(
                profiles, cvs, userJobs, users, audit, cvService, skillExtraction, fieldEncryptor);
        lenient().when(fieldEncryptor.decrypt(any(), any())).thenAnswer(inv -> inv.getArgument(0));
        when(skillExtraction.extractForUser(any(), any(), any())).thenReturn(List.of());
        profile = UserProfile.builder()
            .userId(userId)
            .onboarded(false)
            .build();
        user = User.builder().id(userId).name("Old Name").email("a@b.com").username("ab").passwordHash("x").build();
        when(profiles.findByUserId(userId)).thenReturn(Optional.of(profile));
        lenient().when(users.findById(userId)).thenReturn(Optional.of(user));
        when(cvs.findFirstByUserIdAndIsActiveTrueOrderByUploadedAtDesc(userId)).thenReturn(Optional.empty());
        when(profiles.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(users.save(any())).thenAnswer(inv -> inv.getArgument(0));
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
            null,
            true,
            true,
            "Senior Engineer",
            null,
            true,
            "senior",
            work,
            edu,
            "Hybrid",
            "2 Days per week",
            "2 weeks notice",
            null,
            "https://linkedin.com/in/jane",
            "https://github.com/jane",
            "https://jane.dev"
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
        assertThat(profile.getLinkedInUrl()).isEqualTo("https://linkedin.com/in/jane");
        assertThat(profile.getGithubUrl()).isEqualTo("https://github.com/jane");
        assertThat(profile.getWebsiteUrl()).isEqualTo("https://jane.dev");
        assertThat(response.linkedInUrl()).isEqualTo("https://linkedin.com/in/jane");
        assertThat(response.githubUrl()).isEqualTo("https://github.com/jane");
        assertThat(response.websiteUrl()).isEqualTo("https://jane.dev");
        verify(audit).log(userId, "ONBOARDING_COMPLETE", java.util.Map.of("targetRole", "Full Stack Developer"));
    }

    @Test
    void upsert_persistsWorkTypesFromOnboardingPayload() {
        var req = new ProfileRequest(
            null,
            new String[] { "Engineer" },
            null,
            null,
            null,
            null,
            null,
            null,
            new String[] { "Full-time", "Contract" },
            null,
            null,
            null,
            true,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
        );

        profileService.upsert(userId, req, null);

        assertThat(profile.getWorkTypes()).containsExactly("Full-time", "Contract");
        assertThat(profile.getSectors()).containsExactly("Full-time", "Contract");
    }

    @Test
    void upsert_mirrorsSectorsToWorkTypes() {
        var req = new ProfileRequest(
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            new String[] { "Part-time", "Contract" },
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
        );

        profileService.upsert(userId, req, null);

        assertThat(profile.getSectors()).containsExactly("Part-time", "Contract");
        assertThat(profile.getWorkTypes()).containsExactly("Part-time", "Contract");
    }

    @Test
    void upsert_withNameChange_persistsAfterGetStyleLoad() {
        profile.setVersion(2L);
        profile.setOnboarded(true);
        profile.setLocation("Dublin");

        when(profiles.findByUserId(userId)).thenReturn(Optional.of(profile));

        var req = new ProfileRequest(
            "Updated Name",
            new String[] { "Engineer" },
            null,
            "Dublin, Ireland",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
        );

        profileService.get(userId);
        var response = profileService.upsert(userId, req, 2L);

        assertThat(user.getName()).isEqualTo("Updated Name");
        assertThat(profile.getLocation()).isEqualTo("Dublin, Ireland");
        assertThat(response.targetRoles()).containsExactly("Engineer");
        verify(users).save(user);
        verify(profiles).save(profile);
    }

    @Test
    void upsert_withNullVersion_reloadsWritableProfileBeforeSave() {
        UserProfile stale = UserProfile.builder()
            .userId(userId)
            .onboarded(true)
            .location("Dublin")
            .build();
        UserProfile fresh = UserProfile.builder()
            .userId(userId)
            .onboarded(true)
            .location("Dublin")
            .version(1L)
            .build();

        when(profiles.findByUserId(userId))
            .thenReturn(Optional.of(stale))
            .thenReturn(Optional.of(fresh));

        var req = new ProfileRequest(
            null,
            new String[] { "Engineer" },
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
        );

        profileService.upsert(userId, req, null);

        assertThat(fresh.getTargetRoles()).containsExactly("Engineer");
        verify(profiles).save(fresh);
    }
}
