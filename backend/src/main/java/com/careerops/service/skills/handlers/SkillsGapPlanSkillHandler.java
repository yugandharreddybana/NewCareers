package com.careerops.service.skills.handlers;

import com.careerops.service.SkillMdExecutorService;
import com.careerops.service.skills.SkillHandler;
import com.careerops.service.skills.SkillHandlerResult;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class SkillsGapPlanSkillHandler implements SkillHandler {

    private final SkillMdExecutorService executor;

    public SkillsGapPlanSkillHandler(SkillMdExecutorService executor) {
        this.executor = executor;
    }

    @Override
    public String skillName() { return "skills-gap-plan"; }

    @Override
    public SkillHandlerResult execute(UUID userId, UUID userJobId) {
        var result = executor.executeWithUsage(skillName(), userId, userJobId, null);
        return new SkillHandlerResult(result.output(), result.totalTokens());
    }
}
