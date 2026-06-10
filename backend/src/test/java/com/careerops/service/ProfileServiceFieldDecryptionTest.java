package com.careerops.service;

import com.careerops.dto.ProfileDtos.ProfileResponse;
import com.careerops.model.UserProfile;
import com.careerops.repository.UserCvRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.repository.UserRepository;
import com.careerops.security.AesFieldEncryptor;
import com.careerops.service.UserKeyService;
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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProfileServiceFieldDecryptionTest {

    private static final byte[] USER_DEK = new byte[32];
    private static final UUID USER_ID = UUID.randomUUID();

    @Mock UserProfileRepository profiles;
    @Mock UserCvRepository cvs;
    @Mock UserJobRepository userJobs;
    @Mock UserRepository users;
    @Mock AuditLogService audit;
    @Mock CvService cvService;
    @Mock CvSkillExtractionService skillExtraction;
    @Mock UserKeyService userKeyService;

    ProfileService profileService;
    AesFieldEncryptor encryptor;

    @BeforeEach
    void setUp() {
        USER_DEK[0] = 9;
        encryptor = AesFieldEncryptor.forTest(userKeyService, null);
        profileService = new ProfileService(
                profiles, cvs, userJobs, users, audit, cvService, skillExtraction, encryptor);
        lenient().when(userKeyService.getUserDek(USER_ID)).thenReturn(USER_DEK);
        lenient().when(skillExtraction.extractForUser(any(), any(), any())).thenReturn(List.of());
        lenient().when(cvs.findFirstByUserIdAndIsActiveTrueOrderByUploadedAtDesc(USER_ID))
                .thenReturn(Optional.empty());
    }

    @Test
    void get_decryptsEncryptedProfileFieldsInResponse() {
        String headline = "Senior Software Engineer";
        String location = "Dublin, Ireland";
        String goalLocation = "Remote in Ireland";

        UserProfile profile = UserProfile.builder()
                .userId(USER_ID)
                .goalTitle(encryptor.encrypt(headline, USER_ID))
                .location(encryptor.encrypt(location, USER_ID))
                .goalLocation(encryptor.encrypt(goalLocation, USER_ID))
                .build();

        when(profiles.findByUserId(USER_ID)).thenReturn(Optional.of(profile));

        ProfileResponse response = profileService.get(USER_ID);

        assertThat(response.goalTitle()).isEqualTo(headline);
        assertThat(response.location()).isEqualTo(location);
        assertThat(response.goalLocation()).isEqualTo(goalLocation);
    }
}
