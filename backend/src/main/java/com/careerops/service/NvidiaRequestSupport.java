package com.careerops.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.Map;
import java.util.Set;

/**
 * Nemotron request options for NVIDIA NIM chat/completions.
 *
 * THINKING_SKILLS: features that receive chain-of-thought reasoning_budget.
 *   These are a subset of the features that also use the premium model
 *   (tailor-resume, cover-letter) PLUS evaluate and skills-gap-plan which
 *   benefit from thinking even if they run on the fast model.
 *
 * Model tier is resolved separately in NvidiaService.PREMIUM_FEATURES:
 *   Premium (nvidia/llama-3.3-nemotron-super-49b-v1): tailor-resume, cover-letter
 *   Fast    (nvidia/nemotron-3-nano-30b-a3b):          everything else
 */
public final class NvidiaRequestSupport {

    private static final Set<String> THINKING_SKILLS = Set.of(
            "tailor-resume",
            "cover-letter",
            "evaluate",
            "skills-gap-plan"
    );

    private NvidiaRequestSupport() {}

    public record NemotronConfig(
            int maxTokens,
            int reasoningBudget,
            double temperature,
            double topP
    ) {}

    public static boolean shouldUseThinking(String skillOrFeature) {
        return THINKING_SKILLS.contains(normalizeSkill(skillOrFeature));
    }

    public static String normalizeSkill(String skillOrFeature) {
        if (skillOrFeature == null || skillOrFeature.isBlank()) {
            return "";
        }
        if (skillOrFeature.startsWith("skill-")) {
            return skillOrFeature.substring("skill-".length());
        }
        return skillOrFeature.trim();
    }

    public static int resolveMaxTokens(
            String skillOrFeature,
            Map<String, Integer> fastSkillCaps,
            int thinkingMaxTokens,
            int defaultFastCap) {
        if (shouldUseThinking(skillOrFeature)) {
            return thinkingMaxTokens;
        }
        String skill = normalizeSkill(skillOrFeature);
        return fastSkillCaps.getOrDefault(skill, defaultFastCap);
    }

    /**
     * Applies temperature/top_p to every call. Thinking skills also get reasoning_budget
     * and chat_template_kwargs.enable_thinking (plus force_nonempty_content when tools are used).
     *
     * Non-thinking fast skills explicitly set enable_thinking=false because Nemotron 3 Nano
     * enables chain-of-thought by default and can exhaust max_tokens before JSON content.
     */
    public static void applyNemotronOptions(
            ObjectNode body,
            String skillOrFeature,
            boolean hasTools,
            NemotronConfig cfg,
            ObjectMapper mapper) {
        body.put("temperature", cfg.temperature());
        body.put("top_p", cfg.topP());

        ObjectNode chatTemplateKwargs = mapper.createObjectNode();

        if (!shouldUseThinking(skillOrFeature)) {
            chatTemplateKwargs.put("enable_thinking", false);
            body.set("chat_template_kwargs", chatTemplateKwargs);
            return;
        }

        int maxTokens = body.has("max_tokens")
                ? body.path("max_tokens").asInt(cfg.maxTokens())
                : cfg.maxTokens();
        int reasoningBudget = Math.min(cfg.reasoningBudget(), maxTokens - 1);
        if (reasoningBudget < 1) {
            reasoningBudget = Math.max(1, maxTokens / 2);
        }
        body.put("max_tokens", maxTokens);
        body.put("reasoning_budget", reasoningBudget);

        chatTemplateKwargs.put("enable_thinking", true);
        if (hasTools) {
            chatTemplateKwargs.put("force_nonempty_content", true);
        }
        body.set("chat_template_kwargs", chatTemplateKwargs);
    }
}
