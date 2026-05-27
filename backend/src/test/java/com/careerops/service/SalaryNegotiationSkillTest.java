package com.careerops.service;

import com.careerops.model.UserProfile;
import com.careerops.repository.JobRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.service.skills.handlers.SalaryNegotiationSkillHandler;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SalaryNegotiationSkillTest {

    @Mock private NvidiaService nvidia;
    @Mock private UserProfileRepository profiles;
    @Mock private UserJobRepository userJobs;
    @Mock private JobRepository jobs;
    @Mock private CvService cvService;
    private final ObjectMapper mapper = new ObjectMapper();

    @InjectMocks
    private SalaryNegotiationSkillHandler skill;

    @Test
    @DisplayName("execute — triggers NVIDIA with profile context")
    void execute_triggersClaudeWithProfileContext() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID userJobId = UUID.randomUUID();

        UserProfile p = new UserProfile();
        p.setTargetRoles(new String[]{"Data Engineer"});
        when(profiles.findByUserId(userId)).thenReturn(Optional.of(p));

        JsonNode response = mapper.readTree("{\"salaryBand\": {\"min\": 60000}}");
        when(nvidia.generateJson(anyString(), anyString(), any(UUID.class), anyString())).thenReturn(response);

        JsonNode result = skill.execute(userId, userJobId);

        assertThat(result).isNotNull();
        assertThat(result.path("salaryBand").path("min").asInt()).isEqualTo(60000);
    }
}
