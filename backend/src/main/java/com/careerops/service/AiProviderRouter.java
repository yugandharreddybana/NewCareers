package com.careerops.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.function.Supplier;

/**
 * Batch 3 — AI Provider Router
 *
 * Routes AI scoring calls to the best available provider.
 * Primary: NVIDIA (fast, cheap).
 * Fallback: Claude (reliable, slightly slower).
 *
 * Failover triggers when NVIDIA is "degraded" as measured by
 * AiProviderMetricsService (3+ consecutive failures OR avg latency > threshold).
 *
 * Usage:
 * <pre>
 *   String result = router.route(
 *       () -> nvidiaService.generate(prompt, userId, tag),   // primary
 *       () -> claudeDirectService.generate(prompt, userId),  // fallback
 *       userId
 *   );
 * </pre>
 *
 * The router also records success/failure metrics automatically.
 */
@Service
@Slf4j
public class AiProviderRouter {

    private final AiProviderMetricsService metrics;
    private final NvidiaAgentService nvidiaAgent;
    private final ClaudeDirectService claudeDirect;

    @Value("${ai.router.latency.threshold.ms:8000}")
    private long latencyThresholdMs;

    public static final String PROVIDER_NVIDIA = "nvidia";
    public static final String PROVIDER_CLAUDE = "claude";

    public AiProviderRouter(AiProviderMetricsService metrics,
                             NvidiaAgentService nvidiaAgent,
                             ClaudeDirectService claudeDirect) {
        this.metrics = metrics;
        this.nvidiaAgent = nvidiaAgent;
        this.claudeDirect = claudeDirect;
    }

    // ── Main routing method ────────────────────────────────────────────────────

    /**
     * Execute the primary supplier; fall back to the secondary on failure or degradation.
     * Metrics are recorded automatically for both providers.
     *
     * @param primary   NVIDIA call (cheap, fast)
     * @param fallback  Claude call (reliable)
     * @param context   human-readable label for logging (e.g. userId or skill tag)
     * @return result string from whichever provider succeeded
     * @throws RuntimeException if both providers fail
     */
    public String route(Supplier<String> primary, Supplier<String> fallback, String context) {
        // If NVIDIA is already degraded, skip straight to Claude
        if (metrics.isDegraded(PROVIDER_NVIDIA, latencyThresholdMs)) {
            log.warn("[AiRouter] NVIDIA degraded (consecutive={} avgLatency={}ms) — routing straight to Claude for context={}",
                    metrics.consecutiveFailures(PROVIDER_NVIDIA),
                    metrics.avgLatency(PROVIDER_NVIDIA),
                    context);
            return executeFallback(fallback, context);
        }

        // Try primary (NVIDIA)
        long start = System.currentTimeMillis();
        try {
            String result = primary.get();
            metrics.recordSuccess(PROVIDER_NVIDIA, System.currentTimeMillis() - start);
            return result;
        } catch (Exception primaryEx) {
            metrics.recordFailure(PROVIDER_NVIDIA);
            log.warn("[AiRouter] NVIDIA failed for context={}: {} — falling back to Claude",
                    context, primaryEx.getMessage());
        }

        // Fallback (Claude)
        return executeFallback(fallback, context);
    }

    /**
     * Convenience overload: wraps NvidiaAgentService.chat() and ClaudeDirectService.generate()
     * with a shared prompt. Use this for simple text-in / text-out scoring calls.
     */
    public String routePrompt(String prompt, java.util.UUID userId, String tag) {
        return route(
            () -> nvidiaAgent.chat(prompt, userId, tag),
            () -> claudeDirect.generate(prompt, userId),
            userId + "/" + tag
        );
    }

    // ── Internal ───────────────────────────────────────────────────────────────

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
