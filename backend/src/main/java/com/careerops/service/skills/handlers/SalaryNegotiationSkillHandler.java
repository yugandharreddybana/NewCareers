package com.careerops.service.skills.handlers;

import com.careerops.service.SkillMdExecutorService;
import com.careerops.service.skills.SkillHandler;
import com.fasterxml.jackson.databind.JsonNode;
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
    public JsonNode execute(UUID userId, UUID userJobId) {
        return executor.execute(skillName(), userId, userJobId, null);
    }
}
