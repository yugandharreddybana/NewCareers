package com.careerops.service;

import com.careerops.model.UserProfile;
import com.careerops.repository.UserProfileRepository;
import com.careerops.repository.UserJobRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProfileValidatorTest {

    @Mock private UserProfileRepository profiles;
    @Mock private UserJobRepository userJobs;
    @Mock private CvService cvService;

    @InjectMocks
    private ProfileValidator validator;

    @Test
    @DisplayName("validateForSkill — empty when valid")
    void validateForSkill_emptyWhenValid() throws Exception {
        UUID userId = UUID.randomUUID();
        when(cvService.activeCvText(userId)).thenReturn("Full CV text here");

        UserProfile p = new UserProfile();
        p.setTargetRoles(new String[]{"Frontend Developer"});
        when(profiles.findByUserId(userId)).thenReturn(Optional.of(p));

        List<String> missing = validator.validateForSkill(userId, "evaluate");
        assertThat(missing).isEmpty();
    }
}
