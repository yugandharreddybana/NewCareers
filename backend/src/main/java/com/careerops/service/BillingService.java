package com.careerops.service;

import com.careerops.billing.BillingWebhookIdempotency;
import com.careerops.billing.CheckoutSessionResult;
import com.careerops.billing.PortalSessionResult;
import com.careerops.billing.StripeGateway;
import com.careerops.billing.StripePlanMapper;
import com.careerops.billing.StripeProperties;
import com.careerops.dto.BillingDtos.SessionUrlResponse;
import com.careerops.dto.BillingDtos.SubscriptionResponse;
import com.careerops.dto.BillingDtos.UsageThisMonth;
import com.careerops.exception.ApiException;
import com.careerops.model.OrgMember;
import com.careerops.model.Subscription;
import com.careerops.model.SubscriptionPlan;
import com.careerops.model.SubscriptionStatus;
import com.careerops.model.User;
import com.careerops.repository.OrgMemberRepository;
import com.careerops.repository.SubscriptionRepository;
import com.careerops.repository.UserRepository;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.StripeObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class BillingService {

    private static final Logger log = LoggerFactory.getLogger(BillingService.class);

    private final OrganizationSubscriptionResolver subscriptionResolver;
    private final SubscriptionRepository subscriptionRepository;
    private final OrgMemberRepository orgMemberRepository;
    private final UserRepository userRepository;
    private final StripeGateway stripeGateway;
    private final StripeProperties stripeProperties;
    private final StripePlanMapper planMapper;
    private final BillingWebhookIdempotency webhookIdempotency;
    private final OrgUsageCounter orgUsageCounter;
    private final SaasLifecycleTelemetry lifecycleTelemetry;
    private final String corsAllowedOrigins;

    public BillingService(
            OrganizationSubscriptionResolver subscriptionResolver,
            SubscriptionRepository subscriptionRepository,
            OrgMemberRepository orgMemberRepository,
            UserRepository userRepository,
            StripeGateway stripeGateway,
            StripeProperties stripeProperties,
            StripePlanMapper planMapper,
            BillingWebhookIdempotency webhookIdempotency,
            OrgUsageCounter orgUsageCounter,
            SaasLifecycleTelemetry lifecycleTelemetry,
            @Value("${cors.allowed.origins}") String corsAllowedOrigins) {
        this.subscriptionResolver = subscriptionResolver;
        this.subscriptionRepository = subscriptionRepository;
        this.orgMemberRepository = orgMemberRepository;
        this.userRepository = userRepository;
        this.stripeGateway = stripeGateway;
        this.stripeProperties = stripeProperties;
        this.planMapper = planMapper;
        this.webhookIdempotency = webhookIdempotency;
        this.orgUsageCounter = orgUsageCounter;
        this.lifecycleTelemetry = lifecycleTelemetry;
        this.corsAllowedOrigins = corsAllowedOrigins;
    }

    @Transactional(readOnly = true)
    public SubscriptionResponse getSubscriptionForUser(UUID userId) {
        SubscriptionContext ctx = subscriptionResolver.resolveForUser(userId);
        Subscription subscription = subscriptionRepository.findByOrganizationId(ctx.orgId())
                .orElseThrow(() -> ApiException.notFound("Subscription not found for organization"));

        return new SubscriptionResponse(
                ctx.plan(),
                ctx.status(),
                subscription.getTrialEndsAt(),
                subscription.getCurrentPeriodEnd(),
                computeDaysRemaining(subscription),
                new UsageThisMonth(
                        orgUsageCounter.aiSkillRunsThisMonth(ctx.orgId()),
                        orgUsageCounter.jobApplicationsThisMonth(ctx.orgId())));
    }

    private static int computeDaysRemaining(Subscription subscription) {
        if (subscription.getStatus() != SubscriptionStatus.TRIALING || subscription.getTrialEndsAt() == null) {
            return 0;
        }
        LocalDate endDate = subscription.getTrialEndsAt().atZone(ZoneOffset.UTC).toLocalDate();
        long days = ChronoUnit.DAYS.between(LocalDate.now(ZoneOffset.UTC), endDate);
        return (int) Math.max(0, days);
    }

    @Transactional
    public SessionUrlResponse createCheckoutSession(UUID userId, SubscriptionPlan plan) {
        if (plan != SubscriptionPlan.PRO && plan != SubscriptionPlan.ENTERPRISE) {
            throw ApiException.badRequest("Checkout is only available for PRO or ENTERPRISE plans");
        }

        SubscriptionContext ctx = subscriptionResolver.resolveForUser(userId);
        assertBillingAdmin(userId, ctx.orgId());

        Subscription subscription = subscriptionRepository.findByOrganizationId(ctx.orgId())
                .orElseThrow(() -> ApiException.notFound("Subscription not found for organization"));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));

        if (subscription.getStripeCustomerId() == null || subscription.getStripeCustomerId().isBlank()) {
            String customerId = stripeGateway.createCustomer(user.getEmail(), ctx.orgId());
            subscription.setStripeCustomerId(customerId);
            subscriptionRepository.save(subscription);
        }

        String priceId = planMapper.priceIdForPlan(plan);
        Map<String, String> metadata = new HashMap<>();
        metadata.put("organizationId", ctx.orgId().toString());
        metadata.put("plan", plan.name());
        metadata.put("userId", userId.toString());

        CheckoutSessionResult result = stripeGateway.createCheckoutSession(
                subscription.getStripeCustomerId(),
                priceId,
                resolveSuccessUrl(),
                resolveCancelUrl(),
                metadata);

        return new SessionUrlResponse(result.url());
    }

    @Transactional(readOnly = true)
    public SessionUrlResponse createCustomerPortalSession(UUID userId) {
        SubscriptionContext ctx = subscriptionResolver.resolveForUser(userId);
        assertBillingAdmin(userId, ctx.orgId());

        Subscription subscription = subscriptionRepository.findByOrganizationId(ctx.orgId())
                .orElseThrow(() -> ApiException.notFound("Subscription not found for organization"));

        if (subscription.getStripeCustomerId() == null || subscription.getStripeCustomerId().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "No billing account exists for this organization");
        }

        PortalSessionResult result = stripeGateway.createCustomerPortalSession(
                subscription.getStripeCustomerId(),
                resolvePortalReturnUrl());

        return new SessionUrlResponse(result.url());
    }

    @Transactional
    public void handleWebhook(String payload, String signatureHeader) {
        Event event;
        try {
            event = stripeGateway.constructWebhookEvent(payload, signatureHeader);
        } catch (SignatureVerificationException ex) {
            log.warn("Stripe webhook signature verification failed: {}", ex.getMessage());
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid Stripe signature");
        }

        if (!webhookIdempotency.acquire(event.getId())) {
            log.debug("Stripe webhook event already processed: {}", event.getId());
            return;
        }

        switch (event.getType()) {
            case "checkout.session.completed" -> handleCheckoutSessionCompleted(event);
            case "customer.subscription.updated" -> handleSubscriptionUpdated(event);
            case "customer.subscription.deleted" -> handleSubscriptionDeleted(event);
            default -> log.debug("Ignoring unsupported Stripe event type: {}", event.getType());
        }
    }

    private void handleCheckoutSessionCompleted(Event event) {
        com.stripe.model.checkout.Session session = deserialize(event, com.stripe.model.checkout.Session.class);
        if (session == null) {
            log.warn("checkout.session.completed missing session payload eventId={}", event.getId());
            return;
        }

        String orgIdRaw = session.getMetadata() != null ? session.getMetadata().get("organizationId") : null;
        if (orgIdRaw == null || orgIdRaw.isBlank()) {
            log.warn("checkout.session.completed missing organizationId metadata eventId={}", event.getId());
            return;
        }

        UUID orgId = UUID.fromString(orgIdRaw);
        Subscription subscription = subscriptionRepository.findByOrganizationId(orgId)
                .orElseThrow(() -> new IllegalStateException("Subscription missing for org " + orgId));

        SubscriptionPlan previousPlan = subscription.getPlan();

        subscription.setStripeCustomerId(session.getCustomer());
        subscription.setStripeSubscriptionId(session.getSubscription());
        subscription.setStatus(SubscriptionStatus.ACTIVE);

        String planRaw = session.getMetadata().get("plan");
        if (planRaw != null && !planRaw.isBlank()) {
            subscription.setPlan(SubscriptionPlan.valueOf(planRaw));
        }

        subscriptionRepository.save(subscription);
        trackPlanChangeForOrg(orgId, previousPlan, subscription.getPlan());
    }

    private void handleSubscriptionUpdated(Event event) {
        com.stripe.model.Subscription stripeSubscription =
                deserialize(event, com.stripe.model.Subscription.class);
        if (stripeSubscription == null) {
            log.warn("customer.subscription.updated missing subscription payload eventId={}", event.getId());
            return;
        }

        Subscription subscription = subscriptionRepository.findByStripeSubscriptionId(stripeSubscription.getId())
                .orElseGet(() -> resolveSubscriptionFromCustomer(stripeSubscription.getCustomer()));

        if (subscription == null) {
            log.warn("No local subscription for Stripe subscription {}", stripeSubscription.getId());
            return;
        }

        SubscriptionPlan previousPlan = subscription.getPlan();
        applyStripeSubscription(subscription, stripeSubscription);
        subscriptionRepository.save(subscription);
        trackPlanChangeForOrg(subscription.getOrganizationId(), previousPlan, subscription.getPlan());
    }

    private void handleSubscriptionDeleted(Event event) {
        com.stripe.model.Subscription stripeSubscription =
                deserialize(event, com.stripe.model.Subscription.class);
        if (stripeSubscription == null) {
            log.warn("customer.subscription.deleted missing subscription payload eventId={}", event.getId());
            return;
        }

        subscriptionRepository.findByStripeSubscriptionId(stripeSubscription.getId())
                .ifPresent(subscription -> {
                    SubscriptionPlan previousPlan = subscription.getPlan();
                    subscription.setStatus(SubscriptionStatus.CANCELLED);
                    subscription.setPlan(SubscriptionPlan.FREE);
                    subscriptionRepository.save(subscription);
                    trackPlanChangeForOrg(subscription.getOrganizationId(), previousPlan, subscription.getPlan());
                });
    }

    private void trackPlanChangeForOrg(UUID orgId, SubscriptionPlan fromPlan, SubscriptionPlan toPlan) {
        lifecycleTelemetry.findOrgOwnerUserId(orgId).ifPresent(userId ->
                lifecycleTelemetry.trackPlanChange(userId, fromPlan, toPlan));
    }

    private Subscription resolveSubscriptionFromCustomer(String customerId) {
        if (customerId == null || customerId.isBlank()) {
            return null;
        }
        return subscriptionRepository.findByStripeCustomerId(customerId).orElse(null);
    }

    private void applyStripeSubscription(
            Subscription subscription,
            com.stripe.model.Subscription stripeSubscription) {
        subscription.setStripeSubscriptionId(stripeSubscription.getId());
        subscription.setStripeCustomerId(stripeSubscription.getCustomer());
        subscription.setStatus(planMapper.mapStripeStatus(stripeSubscription.getStatus()));

        if (stripeSubscription.getCurrentPeriodEnd() != null) {
            subscription.setCurrentPeriodEnd(Instant.ofEpochSecond(stripeSubscription.getCurrentPeriodEnd()));
        }

        if (stripeSubscription.getItems() != null
                && stripeSubscription.getItems().getData() != null
                && !stripeSubscription.getItems().getData().isEmpty()
                && stripeSubscription.getItems().getData().getFirst().getPrice() != null) {
            String priceId = stripeSubscription.getItems().getData().getFirst().getPrice().getId();
            subscription.setPlan(planMapper.planForPriceId(priceId));
        }
    }

    private <T extends StripeObject> T deserialize(Event event, Class<T> type) {
        return event.getDataObjectDeserializer()
                .getObject()
                .filter(type::isInstance)
                .map(type::cast)
                .orElse(null);
    }

    private void assertBillingAdmin(UUID userId, UUID orgId) {
        OrgMember member = orgMemberRepository.findByOrgIdAndUserId(orgId, userId)
                .orElseThrow(() -> ApiException.forbidden("Not a member of this organization"));
        if (!"owner".equals(member.getRole()) && !"admin".equals(member.getRole())) {
            throw ApiException.forbidden("Only organization owners or admins can manage billing");
        }
    }

    private String resolveSuccessUrl() {
        String configured = stripeProperties.getCheckout().getSuccessUrl();
        if (configured != null && !configured.isBlank()) {
            return configured;
        }
        return firstCorsOrigin() + "/billing/success";
    }

    private String resolveCancelUrl() {
        String configured = stripeProperties.getCheckout().getCancelUrl();
        if (configured != null && !configured.isBlank()) {
            return configured;
        }
        return firstCorsOrigin() + "/billing/cancel";
    }

    private String resolvePortalReturnUrl() {
        String configured = stripeProperties.getPortalReturnUrl();
        if (configured != null && !configured.isBlank()) {
            return configured;
        }
        return firstCorsOrigin() + "/billing";
    }

    private String firstCorsOrigin() {
        if (corsAllowedOrigins == null || corsAllowedOrigins.isBlank()) {
            return "http://localhost:4000";
        }
        return corsAllowedOrigins.split(",")[0].trim();
    }
}
