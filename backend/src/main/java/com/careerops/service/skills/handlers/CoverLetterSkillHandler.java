package com.careerops.service.skills.handlers;

import com.careerops.model.User;
import com.careerops.model.UserProfile;
import com.careerops.repository.UserProfileRepository;
import com.careerops.repository.UserRepository;
import com.careerops.service.CoverLetterNormalizer;
import com.careerops.service.SkillMdExecutorService;
import com.careerops.service.skills.SkillHandler;
import com.careerops.service.skills.SkillHandlerResult;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class CoverLetterSkillHandler implements SkillHandler {

    private final SkillMdExecutorService executor;
    private final CoverLetterNormalizer normalizer;
    private final UserRepository users;
    private final UserProfileRepository profiles;

    public CoverLetterSkillHandler(
            SkillMdExecutorService executor,
            CoverLetterNormalizer normalizer,
            UserRepository users,
            UserProfileRepository profiles) {
        this.executor = executor;
        this.normalizer = normalizer;
        this.users = users;
        this.profiles = profiles;
    }

    @Override
    public String skillName() { return "cover-letter"; }

    @Override
    public SkillHandlerResult execute(UUID userId, UUID userJobId) {
        SkillMdExecutorService.SkillMdExecuteResult raw =
                executor.executeWithUsage(skillName(), userId, userJobId, null);
        User user = users.findById(userId).orElse(null);
        UserProfile profile = profiles.findByUserId(userId).orElse(null);
        ObjectNode normalized = normalizer.normalize(raw.output(), normalizer.contextFor(user, profile));
        int tokens = raw.totalTokens();
        if (tokens > 0) {
            normalized.put("tokensUsed", tokens);
        }
        return new SkillHandlerResult(normalized, tokens);
    }
}
