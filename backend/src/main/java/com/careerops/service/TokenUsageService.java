package com.careerops.service;

import com.careerops.dto.AnalyticsDtos.*;
import com.careerops.model.AiTokenUsage;
import com.careerops.repository.AiTokenUsageRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
public class TokenUsageService {

    private final AiTokenUsageRepository repo;

    public TokenUsageService(AiTokenUsageRepository repo) {
        this.repo = repo;
    }

    /** Called by SkillService after each Claude API call to record token usage. */
    public void record(UUID userId, String feature, String model,
                       int inputTokens, int outputTokens, double costUsd) {
        AiTokenUsage usage = AiTokenUsage.builder()
            .userId(userId)
            .feature(feature)
            .model(model)
            .inputTokens(inputTokens)
            .outputTokens(outputTokens)
            .totalTokens(inputTokens + outputTokens)
            .costUsd(BigDecimal.valueOf(costUsd))
            .build();
        repo.save(usage);
    }

    public TokenUsageResponse getUsageForUser(UUID userId) {
        List<Object[]> rows = repo.summariseByFeatureForUser(userId);
        return buildResponse(rows, userId);
    }

    public TokenUsageResponse getGlobalUsage() {
        List<Object[]> rows = repo.summariseByFeatureGlobal();
        return buildResponseFromRows(rows);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private TokenUsageResponse buildResponse(List<Object[]> rows, UUID userId) {
        List<TokenUsageSummary> summaries = rows.stream()
            .map(this::toSummary).toList();
        long grandTokens = summaries.stream().mapToLong(TokenUsageSummary::totalTokens).sum();
        double grandCost = summaries.stream().mapToDouble(TokenUsageSummary::totalCostUsd).sum();
        // estimate monthly from a 30-day window proxy
        double monthly = grandCost * 30;
        return new TokenUsageResponse(summaries, grandTokens, grandCost, monthly);
    }

    private TokenUsageResponse buildResponseFromRows(List<Object[]> rows) {
        List<TokenUsageSummary> summaries = rows.stream()
            .map(this::toSummary).toList();
        long grandTokens = summaries.stream().mapToLong(TokenUsageSummary::totalTokens).sum();
        double grandCost = summaries.stream().mapToDouble(TokenUsageSummary::totalCostUsd).sum();
        double monthly = grandCost * 30;
        return new TokenUsageResponse(summaries, grandTokens, grandCost, monthly);
    }

    private TokenUsageSummary toSummary(Object[] row) {
        // row: [feature, model, totalTokens, totalCost, requestCount]
        String  feature  = (String)  row[0];
        String  model    = (String)  row[1];
        long    tokens   = ((Number) row[2]).longValue();
        double  cost     = ((Number) row[3]).doubleValue();
        long    requests = ((Number) row[4]).longValue();
        return new TokenUsageSummary(feature, model, tokens, cost, requests);
    }

    public boolean hasExceededBudget(UUID userId, long dailyBudget) {
        java.time.Instant since = java.time.Instant.now().minus(java.time.Duration.ofDays(1));
        long tokensUsedToday = repo.sumTokensByUserSince(userId, since);
        return tokensUsedToday >= dailyBudget;
    }
}
