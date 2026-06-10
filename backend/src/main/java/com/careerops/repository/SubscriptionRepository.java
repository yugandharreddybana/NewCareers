package com.careerops.repository;

import com.careerops.model.Subscription;
import com.careerops.model.SubscriptionPlan;
import com.careerops.model.SubscriptionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SubscriptionRepository extends JpaRepository<Subscription, UUID> {
    Optional<Subscription> findByOrganizationId(UUID organizationId);

    @Query(value = "SELECT * FROM careerops.subscriptions WHERE organization_id = :orgId FOR UPDATE", nativeQuery = true)
    Optional<Subscription> findByOrganizationIdForUpdate(@Param("orgId") UUID orgId);
    Optional<Subscription> findByStripeSubscriptionId(String stripeSubscriptionId);
    Optional<Subscription> findByStripeCustomerId(String stripeCustomerId);
    boolean existsByOrganizationId(UUID organizationId);

    long countByStatusIn(Collection<SubscriptionStatus> statuses);

    long countByStatus(SubscriptionStatus status);

    @Query("""
            SELECT COUNT(s) FROM Subscription s
            WHERE s.status = com.careerops.model.SubscriptionStatus.CANCELLED
              AND s.updatedAt >= :since
            """)
    long countCancelledSince(@Param("since") Instant since);

    @Query("""
            SELECT COUNT(s) FROM Subscription s
            WHERE s.status = com.careerops.model.SubscriptionStatus.ACTIVE
              AND s.trialEndsAt IS NOT NULL
              AND s.trialEndsAt < :now
            """)
    long countActiveWithPastTrial(@Param("now") Instant now);

    @Query("""
            SELECT s.plan, COUNT(s) FROM Subscription s
            WHERE s.status = com.careerops.model.SubscriptionStatus.ACTIVE
            GROUP BY s.plan
            """)
    List<Object[]> countActiveGroupByPlan();

    @Query("""
            SELECT s, o.name FROM Subscription s
            JOIN Organization o ON o.id = s.organizationId
            WHERE (:plan IS NULL OR s.plan = :plan)
              AND (:status IS NULL OR s.status = :status)
              AND (:search IS NULL OR :search = '' OR LOWER(o.name) LIKE LOWER(CONCAT('%', :search, '%')))
            ORDER BY s.updatedAt DESC
            """)
    Page<Object[]> findAllWithOrgName(
            @Param("plan") SubscriptionPlan plan,
            @Param("status") SubscriptionStatus status,
            @Param("search") String search,
            Pageable pageable);

    @Query("""
            SELECT s FROM Subscription s
            WHERE s.status = :status
              AND s.trialEndsAt >= :start
              AND s.trialEndsAt < :end
            """)
    List<Subscription> findTrialsEndingBetween(
            @Param("status") SubscriptionStatus status,
            @Param("start") Instant start,
            @Param("end") Instant end);

    @Query("""
            SELECT s FROM Subscription s
            WHERE s.status = :status
              AND s.trialEndsAt < :now
            """)
    List<Subscription> findExpiredTrialing(
            @Param("status") SubscriptionStatus status,
            @Param("now") Instant now);
}
