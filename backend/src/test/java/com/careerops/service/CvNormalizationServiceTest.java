package com.careerops.service;

import com.careerops.model.UserCv;
import com.careerops.repository.UserCvRepository;
import com.careerops.repository.UserProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CvNormalizationServiceTest {

    @Mock NvidiaService nvidia;
    @Mock UserCvRepository cvRepo;
    @Mock UserProfileRepository profiles;
    @Mock UserJobSkillMatchService skillMatchService;
    @Mock ProfileReadableFields profileFields;

    CvNormalizationService service;
    UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new CvNormalizationService(
                nvidia, cvRepo, profiles, skillMatchService, profileFields);
        when(nvidia.isConfigured()).thenReturn(false);
    }

    @Test
    void normalizeMarkdownOnly_updatesMarkdownWithoutRefreshingJobs() {
        UserCv cv = UserCv.builder()
                .userId(userId)
                .parsedText("Jane Doe\n\nSoftware engineer with Java experience.")
                .build();
        when(cvRepo.findFirstByUserIdAndIsActiveTrueOrderByUploadedAtDesc(userId))
                .thenReturn(Optional.of(cv));
        when(profiles.findByUserId(userId)).thenReturn(Optional.empty());

        String markdown = service.normalizeMarkdownOnly(userId);

        assertThat(markdown).contains("##");
        verify(cvRepo).save(cv);
        verify(skillMatchService, never()).refreshAllForUser(eq(userId));
    }

    @Test
    void normalizeAndStore_refreshesPipelineMatches() {
        UserCv cv = UserCv.builder()
                .userId(userId)
                .parsedText("Jane Doe\n\nSoftware engineer with Java experience.")
                .build();
        when(cvRepo.findFirstByUserIdAndIsActiveTrueOrderByUploadedAtDesc(userId))
                .thenReturn(Optional.of(cv));
        when(profiles.findByUserId(userId)).thenReturn(Optional.empty());

        service.normalizeAndStore(userId);

        verify(skillMatchService).refreshAllForUser(userId);
    }
}
