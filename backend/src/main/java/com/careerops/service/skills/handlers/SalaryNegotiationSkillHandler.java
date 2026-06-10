package com.careerops.service.skills.handlers;

import com.careerops.service.SkillMdExecutorService;
import com.careerops.service.skills.SkillHandler;
import com.careerops.service.skills.SkillHandlerResult;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class SalaryNegotiationSkillHandler implements SkillHandler {

    private final SkillMdExecutorService executor;

    public SalaryNegotiationSkillHandler(SkillMdExecutorService executor) {
        this.executor = executor;
    }

    @Override
    public String skillName() { return "salary-negotiation"; }

    @Override
    public SkillHandlerResult execute(UUID userId, UUID userJobId) {
        var result = executor.executeWithUsage(skillName(), userId, userJobId, null);
        return new SkillHandlerResult(result.output(), result.totalTokens());
    }
}
