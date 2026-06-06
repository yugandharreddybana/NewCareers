package com.careerops.service;

import com.careerops.model.UserProfile;
import com.careerops.repository.JobRepository;
import com.careerops.repository.SkillRunRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SkillToolDispatcherTest {

    @Mock UserProfileRepository profiles;
    @Mock UserJobRepository userJobs;
    @Mock JobRepository jobs;
    @Mock SkillRunRepository skillRuns;
    @Mock CvService cvService;
    @Mock SupabaseStorageService supabase;
    @Mock TailorResumePendingStore tailorResumePending;

    SkillToolDispatcher dispatcher;
    UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        dispatcher = new SkillToolDispatcher(
                profiles, userJobs, jobs, skillRuns, cvService,
                supabase, tailorResumePending, new ObjectMapper());
    }

    @Test
    void readResume_truncatesAt4000Chars() throws Exception {
        when(cvService.activeCvText(userId)).thenReturn("x".repeat(5000));
        String result = dispatcher.dispatch("read_resume", new ObjectMapper().createObjectNode(), userId, null);
        assertThat(result).contains("...[truncated for length]");
        assertThat(result).doesNotContain("x".repeat(5000));
        assertThat(result.length()).isLessThanOrEqualTo(4000 + "\n...[truncated for length]".length());
    }

    @Test
    void isTimeout_detectsJavaTimeoutException() {
        assertThat(SkillToolDispatcher.isTimeout(
                new RuntimeException(new java.util.concurrent.TimeoutException()))).isTrue();
    }

    @Test
    void isTimeout_returnsFalseForOtherErrors() {
        assertThat(SkillToolDispatcher.isTimeout(new RuntimeException("connection refused"))).isFalse();
    }

    @Test
    void readProfile_truncatesAt6000Chars() {
        UserProfile p = new UserProfile();
        p.setLocation("x".repeat(7000));
        when(profiles.findByUserId(userId)).thenReturn(Optional.of(p));
        String result = dispatcher.dispatch("read_profile", new ObjectMapper().createObjectNode(), userId, null);
        assertThat(result).contains("...[truncated for length]");
    }
}
