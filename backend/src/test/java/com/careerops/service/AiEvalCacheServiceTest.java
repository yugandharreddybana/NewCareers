package com.careerops.service;

import com.careerops.model.SkillRun;
import com.careerops.model.UserJob;
import com.careerops.repository.SkillRunRepository;
import com.careerops.repository.UserJobRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiEvalCacheServiceTest {

    @Mock SkillRunRepository skillRunRepository;
    @Mock UserJobRepository userJobRepository;

    AiEvalCacheService cache;

    final UUID userId = UUID.randomUUID();
    final UUID jobId = UUID.randomUUID();
    final UUID userJobId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        cache = new AiEvalCacheService(skillRunRepository, userJobRepository, new ObjectMapper());
    }

    @Test
    void putStoresEvalCacheUnderUserJobIdNotJobId() {
        UserJob uj = new UserJob();
        uj.setId(userJobId);
        when(userJobRepository.findByUserIdAndJobId(userId, jobId)).thenReturn(Optional.of(uj));
        when(skillRunRepository.save(any(SkillRun.class))).thenAnswer(inv -> inv.getArgument(0));

        cache.put(userId, jobId, "DEEP_EVAL", "{\"matchPercent\":72}");

        ArgumentCaptor<SkillRun> captor = ArgumentCaptor.forClass(SkillRun.class);
        verify(skillRunRepository).save(captor.capture());
        SkillRun saved = captor.getValue();
        assertThat(saved.getUserJobId()).isEqualTo(userJobId);
        assertThat(saved.getSkill()).isEqualTo("DEEP_EVAL");
        assertThat(saved.getUserId()).isEqualTo(userId);
    }

    @Test
    void putSkipsWhenPipelineRowMissing() {
        when(userJobRepository.findByUserIdAndJobId(userId, jobId)).thenReturn(Optional.empty());

        cache.put(userId, jobId, "LIGHT_SCORE", "{\"matchPercent\":50}");

        verify(skillRunRepository, org.mockito.Mockito.never()).save(any());
    }
}
