package com.careerops.repository;

import com.careerops.model.AiTokenUsage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AiTokenUsageRepository extends JpaRepository<AiTokenUsage, UUID> {
    List<AiTokenUsage> findByUserIdOrderByCreatedAtDesc(UUID userId);

    @Query("""
        SELECT t.feature, t.model,
               SUM(t.totalTokens) as totalTokens,
               SUM(t.costUsd) as totalCost,
               COUNT(t) as requestCount
        FROM AiTokenUsage t
        WHERE t.userId = :userId
        GROUP BY t.feature, t.model
        ORDER BY totalCost DESC
        """)
    List<Object[]> summariseByFeatureForUser(@Param("userId") UUID userId);

    @Query("""
        SELECT t.feature, t.model,
               SUM(t.totalTokens) as totalTokens,
               SUM(t.costUsd) as totalCost,
               COUNT(t) as requestCount
        FROM AiTokenUsage t
        GROUP BY t.feature, t.model
        ORDER BY totalCost DESC
        """)
    List<Object[]> summariseByFeatureGlobal();

    @Query("SELECT COALESCE(SUM(t.totalTokens), 0) FROM AiTokenUsage t WHERE t.userId = :userId")
    long sumTokensByUser(@Param("userId") UUID userId);

    @Query("SELECT COALESCE(SUM(t.costUsd), 0) FROM AiTokenUsage t WHERE t.userId = :userId")
    double sumCostByUser(@Param("userId") UUID userId);

    @Query("SELECT COALESCE(SUM(t.totalTokens), 0) FROM AiTokenUsage t WHERE t.userId = :userId AND t.createdAt >= :since")
    long sumTokensByUserSince(@Param("userId") UUID userId, @Param("since") java.time.Instant since);
}
