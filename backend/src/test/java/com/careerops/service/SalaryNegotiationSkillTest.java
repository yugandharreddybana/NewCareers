package com.careerops.service;

import com.careerops.service.SkillMdExecutorService.SkillMdExecuteResult;
import com.careerops.service.skills.SkillHandlerResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SalaryNegotiationSkillTest {

    @Mock private SkillMdExecutorService executor;
    private final ObjectMapper mapper = new ObjectMapper();

    @InjectMocks
    private com.careerops.service.skills.handlers.SalaryNegotiationSkillHandler skill;

    @Test
    @DisplayName("execute — delegates to SKILL.md executor")
    void execute_delegatesToSkillMdExecutor() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID userJobId = UUID.randomUUID();

        JsonNode response = mapper.readTree("{\"salaryBand\": {\"min\": 60000}}");
        when(executor.executeWithUsage(eq("salary-negotiation"), eq(userId), eq(userJobId), isNull()))
            .thenReturn(new SkillMdExecuteResult(response, 42));

        SkillHandlerResult result = skill.execute(userId, userJobId);

        assertThat(result.output().path("salaryBand").path("min").asInt()).isEqualTo(60000);
        assertThat(result.totalTokens()).isEqualTo(42);
    }
}
