package com.careerops.service;

import com.careerops.dto.SkillRunResponse;
import com.careerops.model.SkillRun;
import com.careerops.repository.SkillConversationRepository;
import com.careerops.repository.SkillRunRepository;
import com.careerops.service.skills.SkillHandlerRegistry;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SkillServiceTest {

    @Mock private ClaudeAgentService claude;
    @Mock private SkillPromptLibrary prompts;
    @Mock private ProfileValidator validator;
    @Mock private SkillRunRepository skillRuns;
    @Mock private SkillConversationRepository conversations;
    @Mock private SkillHandlerRegistry registry;
    @Spy private ObjectMapper mapper = new ObjectMapper();
    @Mock private ResendEmailService emailService;
    @Mock private NotificationService notificationService;

    @InjectMocks
    private SkillService skillService;

    @Test
    @DisplayName("getLastRun — returns valid result from repository")
    void getLastRun_returnsStoredResult() {
        UUID userId = UUID.randomUUID();
        UUID userJobId = UUID.randomUUID();
        String skill = "evaluate";

        SkillRun run = new SkillRun();
        run.setSkill(skill);
        run.setOutput(mapper.createObjectNode().put("test", "data"));

        when(skillRuns.findFirstByUserIdAndUserJobIdAndSkillOrderByCreatedAtDesc(userId, userJobId, skill))
                .thenReturn(Optional.of(run));

        SkillRunResponse result = skillService.getLastRun(userId, userJobId, skill);

        assertThat(result).isNotNull();
        assertThat(result.type()).isEqualTo(SkillRunResponse.Type.RESULT);
        assertThat(result.data().path("test").asText()).isEqualTo("data");
    }
}
