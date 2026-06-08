package com.careerops.service;

import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Batch 3 — AI Provider Router (updated: Prompt 3 — skill-aware routing)
 *
 * Routes lightweight AI scoring calls through a primary + fallback provider.
 *
 * Primary:  GeminiService  (cheap, fast single-turn calls)
 * Fallback: ClaudeDirectService (reliable, slightly slower)
 *
 * NvidiaAgentService is intentionally NOT used here — it implements a
 * multi-turn agentic loop (run()) that is incompatible with simple
 * text-in / text-out light-scoring calls.
 *
 * Failover triggers when Gemini is "degraded" as measured by
 * AiProviderMetricsService (3+ consecutive failures OR avg latency > threshold).
 *
 * Prompt 3 addition — routeSkill():
 *   Heavy skills (tailor-resume, prep-interview, skills-gap-plan, linkedin-optimize)
 *   always use Claude — quality is non-negotiable, no Gemini fallback.
 *   All other skills use Gemini primary → Claude fallback via existing route().
 *   Emits ai.skill.route{skill, provider} counter on every call.
 */
@Service
@Slf4j
public class AiProviderRouter {

    // ── Fields ──────────────────────────────────────────────────────────────────

    private final AiProviderMetricsService metrics;
    private final GeminiService            gemini;
    private final ClaudeDirectService      claudeDirect;
    private final MeterRegistry            meterRegistry;  // NEW — Prompt 3

    @Value("${ai.router.latency.threshold.ms:8000}")
    private long latencyThresholdMs;

    // ── Constants ───────────────────────────────────────────────────────────────

    public static final String PROVIDER_GEMINI = "gemini";
    public static final String PROVIDER_CLAUDE = "claude";

    // System prompt used for all light-eval Claude fallback calls
    private static final String LIGHT_EVAL_SYSTEM_PROMPT =
        "You are a job-matching engine. Return only valid JSON. No markdown, no explanation.";

    /**
     * Skills where quality is non-negotiable — always routed to Claude, no Gemini fallback.
     * Validated against SkillPromptLibrary.ALL_SKILLS.
     */
    private static final Set<String> HEAVY_SKILLS = Set.of(
        "tailor-resume",
        "prep-interview",
        "skills-gap-plan",
        "linkedin-optimize"
    );

    // ── Constructor ──────────────────────────────────────────────────────────────

    public AiProviderRouter(AiProviderMetricsService metrics,
                             GeminiService gemini,
                             ClaudeDirectService claudeDirect,
                             MeterRegistry meterRegistry) {
        this.metrics       = metrics;
        this.gemini        = gemini;
        this.claudeDirect  = claudeDirect;
        this.meterRegistry = meterRegistry;
    }

    // ════════════════════════════════════════════════════════════════════════
    // PUBLIC METHODS
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Execute the primary supplier; fall back to the secondary on failure or degradation.
     * Metrics are recorded automatically for both providers.
     *
     * @param primary   Gemini call (cheap, fast)
     * @param fallback  Claude call (reliable)
     * @param context   human-readable label for logging (e.g. userId or skill tag)
     * @return result string from whichever provider succeeded
     * @throws RuntimeException if both providers fail
     */
    public String route(Supplier<String> primary, Supplier<String> fallback, String context) {
        // If Gemini is already degraded, skip straight to Claude
        if (metrics.isDegraded(PROVIDER_GEMINI, latencyThresholdMs)) {
            log.warn("[AiRouter] Gemini degraded (consecutive={} avgLatency={}ms) — routing to Claude for context={}",
                    metrics.consecutiveFailures(PROVIDER_GEMINI),
                    metrics.avgLatency(PROVIDER_GEMINI),
                    context);
            return executeFallback(fallback, context);
        }

        // Try primary (Gemini)
        long start = System.currentTimeMillis();
        try {
            String result = primary.get();
            metrics.recordSuccess(PROVIDER_GEMINI, System.currentTimeMillis() - start);
            return result;
        } catch (Exception primaryEx) {
            metrics.recordFailure(PROVIDER_GEMINI);
            log.warn("[AiRouter] Gemini failed for context={}: {} — falling back to Claude",
                    context, primaryEx.getMessage());
        }

        // Fallback (Claude)
        return executeFallback(fallback, context);
    }

    /**
     * Convenience overload: wraps GeminiService.generate() and ClaudeDirectService.generate()
     * with a shared prompt. Use this for simple text-in / text-out scoring calls.
     *
     * ClaudeDirectService.generate() requires a separate system prompt and user prompt;
     * for light-eval calls the system prompt is the fixed LIGHT_EVAL_SYSTEM_PROMPT constant.
     */
    public String routePrompt(String prompt, UUID userId, String tag) {
        return route(
            () -> gemini.generate(prompt, userId, tag),
            () -> claudeDirect.generate(LIGHT_EVAL_SYSTEM_PROMPT, prompt, userId, tag),
            userId + "/" + tag
        );
    }

    /**
     * Skill-aware routing — Prompt 3 addition.
     *
     * Heavy skills (tailor-resume, prep-interview, skills-gap-plan, linkedin-optimize):
     *   Always routed to Claude. No Gemini, no fallback. Exceptions propagate —
     *   quality is non-negotiable for these skills.
     *
     * Light skills (all others):
     *   Gemini primary → Claude fallback via existing route().
     *
     * Emits ai.skill.route{skill=<skillName>, provider=<intended provider>} on every call.
     * Provider latency and failure are tracked via AiProviderMetricsService.
     *
     * @param skillName    the skill being executed (must match SkillPromptLibrary.ALL_SKILLS)
     * @param systemPrompt system/instruction prompt
     * @param userPrompt   user-facing prompt content
     * @param userId       for cache key and provider context
     * @return raw AI response string
     * @throws RuntimeException if heavy skill Claude call fails (no fallback by design)
     */
    public String routeSkill(String skillName, String systemPrompt,
                             String userPrompt, UUID userId) {
        boolean heavy = HEAVY_SKILLS.contains(skillName);

        meterRegistry.counter("ai.skill.route",
                "skill",    skillName,
                "provider", heavy ? PROVIDER_CLAUDE : PROVIDER_GEMINI)
                .increment();

        if (heavy) {
            // Heavy skills: Claude only — no Gemini, no fallback, exception propagates
            long start = System.currentTimeMillis();
            try {
                String result = claudeDirect.generate(systemPrompt, userPrompt, userId, skillName);
                metrics.recordSuccess(PROVIDER_CLAUDE, System.currentTimeMillis() - start);
                return result;
            } catch (Exception ex) {
                metrics.recordFailure(PROVIDER_CLAUDE);
                log.error("[AiRouter] Heavy skill {} failed for userId={}: {}",
                        skillName, userId, ex.getMessage());
                throw new RuntimeException(
                        "Skill " + skillName + " failed: " + ex.getMessage(), ex);
            }
        }

        // Light skills: Gemini primary → Claude fallback via existing route()
        return route(
                () -> gemini.generate(systemPrompt + "\n\n" + userPrompt, userId, skillName),
                () -> claudeDirect.generate(systemPrompt, userPrompt, userId, skillName),
                userId + "/" + skillName
        );
    }

    // ════════════════════════════════════════════════════════════════════════
    // PRIVATE
    // ════════════════════════════════════════════════════════════════════════

    private String executeFallback(Supplier<String> fallback, String context) {
        long start = System.currentTimeMillis();
        try {
            String result = fallback.get();
            metrics.recordSuccess(PROVIDER_CLAUDE, System.currentTimeMillis() - start);
            return result;
        } catch (Exception fallbackEx) {
            metrics.recordFailure(PROVIDER_CLAUDE);
            log.error("[AiRouter] Both providers failed for context={}: {}", context, fallbackEx.getMessage());
            throw new RuntimeException(
                "All AI providers failed for context=" + context + ": " + fallbackEx.getMessage(),
                fallbackEx);
        }
    }
}
