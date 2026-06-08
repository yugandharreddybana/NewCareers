package com.careerops.service;

import com.careerops.config.SaasBillingProperties;
import com.careerops.dto.AdminSaasDtos.AiUsageRow;
import com.careerops.dto.AdminSaasDtos.FeatureFlagRow;
import com.careerops.dto.AdminSaasDtos.OverridePlanRequest;
import com.careerops.dto.AdminSaasDtos.PagedSubscriptionsResponse;
import com.careerops.dto.AdminSaasDtos.SaasMetricsResponse;
import com.careerops.dto.AdminSaasDtos.SubscriptionRow;
import com.careerops.exception.ApiException;
import com.careerops.model.FeatureFlag;
import com.careerops.model.Subscription;
import com.careerops.model.SubscriptionPlan;
import com.careerops.model.SubscriptionStatus;
import com.careerops.repository.AiTokenUsageRepository;
import com.careerops.repository.FeatureFlagRepository;
import com.careerops.repository.OrgRepository;
import com.careerops.repository.SubscriptionRepository;
import com.careerops.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;

@Service
public class AdminSaasService {

    private static final Logger log = LoggerFactory.getLogger(AdminSaasService.class);

    private final UserRepository userRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final FeatureFlagRepository featureFlagRepository;
    private final AiTokenUsageRepository aiTokenUsageRepository;
    private final OrgRepository orgRepository;
    private final SaasBillingProperties saasBillingProperties;
    private final BillingStripeSyncService billingStripeSyncService;
    private final OrganizationPlanSyncService organizationPlanSyncService;

    public AdminSaasService(
            UserRepository userRepository,
            SubscriptionRepository subscriptionRepository,
            FeatureFlagRepository featureFlagRepository,
            AiTokenUsageRepository aiTokenUsageRepository,
            OrgRepository orgRepository,
            SaasBillingProperties saasBillingProperties,
            BillingStripeSyncService billingStripeSyncService,
            OrganizationPlanSyncService organizationPlanSyncService) {
        this.userRepository = userRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.featureFlagRepository = featureFlagRepository;
        this.aiTokenUsageRepository = aiTokenUsageRepository;
        this.orgRepository = orgRepository;
        this.saasBillingProperties = saasBillingProperties;
        this.billingStripeSyncService = billingStripeSyncService;
        this.organizationPlanSyncService = organizationPlanSyncService;
    }

    @Transactional(readOnly = true)
    public SaasMetricsResponse getMetrics() {
        Instant now = Instant.now();
        Instant thirtyDaysAgo = now.minusSeconds(30L * 86_400L);

        long totalUsers = userRepository.countByDeletedAtIsNull();
        long activeSubscriptions = subscriptionRepository.countByStatusIn(
                EnumSet.of(SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING));

        BigDecimal mrr = BigDecimal.ZERO;
        for (Object[] row : subscriptionRepository.countActiveGroupByPlan()) {
            SubscriptionPlan plan = (SubscriptionPlan) row[0];
            long count = (Long) row[1];
            mrr = mrr.add(saasBillingProperties.priceFor(plan).multiply(BigDecimal.valueOf(count)));
        }

        long activeNow = subscriptionRepository.countByStatus(SubscriptionStatus.ACTIVE);
        long cancelledLast30d = subscriptionRepository.countCancelledSince(thirtyDaysAgo);
        double churnRate = (cancelledLast30d * 100.0)
                / Math.max(1, activeNow + cancelledLast30d);

        long trialingNow = subscriptionRepository.countByStatus(SubscriptionStatus.TRIALING);
        long activeWithPastTrial = subscriptionRepository.countActiveWithPastTrial(now);
        double trialConversion = (activeWithPastTrial * 100.0)
                / Math.max(1, trialingNow + activeWithPastTrial);

        return new SaasMetricsResponse(
                totalUsers,
                activeSubscriptions,
                mrr.setScale(2, RoundingMode.HALF_UP),
                roundPercent(churnRate),
                roundPercent(trialConversion),
                now);
    }

    @Transactional(readOnly = true)
    public PagedSubscriptionsResponse listSubscriptions(
            int page, int size, SubscriptionPlan plan, SubscriptionStatus status, String search) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Object[]> result = subscriptionRepository.findAllWithOrgName(plan, status, search, pageable);

        List<SubscriptionRow> rows = result.getContent().stream()
                .map(this::toSubscriptionRow)
                .toList();

        return new PagedSubscriptionsResponse(
                rows,
                result.getTotalElements(),
                result.getTotalPages(),
                page,
                size);
    }

    @Transactional
    public SubscriptionRow overridePlan(UUID orgId, OverridePlanRequest request) {
        Subscription subscription = subscriptionRepository.findByOrganizationId(orgId)
                .orElseThrow(() -> ApiException.notFound("Subscription not found for organization"));

        SubscriptionPlan previousPlan = subscription.getPlan();
        subscription.setPlan(request.plan());
        if (request.status() != null) {
            subscription.setStatus(request.status());
        }

        boolean downgraded = request.plan() == SubscriptionPlan.FREE
                || request.status() == SubscriptionStatus.CANCELLED;
        if (downgraded) {
            billingStripeSyncService.cancelAndDetachStripe(subscription);
        } else if (subscription.getStripeSubscriptionId() != null
                && !subscription.getStripeSubscriptionId().isBlank()
                && !subscription.getStripeSubscriptionId().startsWith("sub_mock_")) {
            log.warn(
                    "Admin upgraded plan locally without Stripe checkout orgId={} from={} to={} — reconcile Stripe manually",
                    orgId,
                    previousPlan,
                    request.plan());
        }

        subscriptionRepository.save(subscription);
        organizationPlanSyncService.syncFromSubscription(orgId, subscription.getPlan());
        log.warn("Admin override plan orgId={} plan={} status={}", orgId, request.plan(), subscription.getStatus());

        String orgName = orgRepository.findById(orgId).map(o -> o.getName()).orElse("Unknown");
        return toSubscriptionRow(new Object[] { subscription, orgName });
    }

    @Transactional(readOnly = true)
    public List<FeatureFlagRow> listFeatureFlags() {
        return featureFlagRepository.findAllByOrderByFlagKeyAsc().stream()
                .map(this::toFeatureFlagRow)
                .toList();
    }

    @Transactional
    @CacheEvict(value = "feature-flags", key = "#result.flagKey()")
    public FeatureFlagRow toggleFeatureFlag(UUID id) {
        FeatureFlag flag = featureFlagRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Feature flag not found"));
        flag.setEnabled(!Boolean.TRUE.equals(flag.getEnabled()));
        FeatureFlag saved = featureFlagRepository.save(flag);
        log.warn("Admin toggled feature flag id={} key={} enabled={}", id, saved.getFlagKey(), saved.getEnabled());
        return toFeatureFlagRow(saved);
    }

    @Transactional(readOnly = true)
    public List<AiUsageRow> topAiUsageThisMonth() {
        Instant monthStart = ZonedDateTime.now(ZoneOffset.UTC)
                .withDayOfMonth(1)
                .withHour(0)
                .withMinute(0)
                .withSecond(0)
                .withNano(0)
                .toInstant();

        return aiTokenUsageRepository.topOrgsByTokensSince(monthStart, PageRequest.of(0, 20)).stream()
                .map(row -> new AiUsageRow(
                        (UUID) row[0],
                        (String) row[1],
                        ((Number) row[2]).longValue(),
                        row[3] == null ? BigDecimal.ZERO : new BigDecimal(row[3].toString()),
                        ((Number) row[4]).longValue()))
                .toList();
    }

    private SubscriptionRow toSubscriptionRow(Object[] row) {
        Subscription s = (Subscription) row[0];
        String orgName = (String) row[1];
        return new SubscriptionRow(
                s.getOrganizationId(),
                orgName,
                s.getPlan(),
                s.getStatus(),
                s.getTrialEndsAt(),
                s.getCurrentPeriodEnd(),
                s.getStripeCustomerId());
    }

    private FeatureFlagRow toFeatureFlagRow(FeatureFlag flag) {
        return new FeatureFlagRow(
                flag.getId(),
                flag.getFlagKey(),
                Boolean.TRUE.equals(flag.getEnabled()),
                flag.getDescription(),
                flag.getUpdatedAt());
    }

    private static double roundPercent(double value) {
        return BigDecimal.valueOf(value).setScale(1, RoundingMode.HALF_UP).doubleValue();
    }
}
