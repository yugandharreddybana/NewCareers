package com.careerops.service;

import com.careerops.billing.BillingWebhookIdempotency;
import com.careerops.billing.WebhookDisposition;
import com.careerops.billing.CheckoutSessionResult;
import com.careerops.billing.PortalSessionResult;
import com.careerops.billing.StripeGateway;
import com.careerops.billing.StripeInvoiceRecord;
import com.careerops.billing.StripePlanMapper;
import com.careerops.billing.StripeProperties;
import com.careerops.billing.SubscriptionPlanResolution;
import com.careerops.config.SaasBillingProperties;
import com.careerops.dto.BillingDtos.CancelSubscriptionResponse;
import com.careerops.dto.BillingDtos.InvoiceResponse;
import com.careerops.dto.BillingDtos.PlanLimitsResponse;
import com.careerops.dto.BillingDtos.PlanResponse;
import com.careerops.dto.BillingDtos.SessionUrlResponse;
import com.careerops.dto.BillingDtos.SubscriptionResponse;
import com.careerops.dto.BillingDtos.UsageMetricsResponse;
import com.careerops.dto.BillingDtos.UsageThisMonth;
import com.careerops.exception.ApiException;
import com.careerops.exception.WebhookProcessingException;
import com.careerops.model.OrgMember;
import com.careerops.model.PlanLimit;
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
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class BillingService {

    private static final Logger log = LoggerFactory.getLogger(BillingService.class);
    private static final int MAX_WEBHOOK_BYTES = 1_048_576;

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
    private final SaasBillingProperties saasBillingProperties;
    private final OrganizationPlanSyncService organizationPlanSyncService;
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
            SaasBillingProperties saasBillingProperties,
            OrganizationPlanSyncService organizationPlanSyncService,
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
        this.saasBillingProperties = saasBillingProperties;
        this.organizationPlanSyncService = organizationPlanSyncService;
        this.corsAllowedOrigins = corsAllowedOrigins;
    }

    @Transactional(readOnly = true)
    public SubscriptionResponse getSubscriptionForUser(UUID userId) {
        SubscriptionContext ctx = subscriptionResolver.resolveForUser(userId);
        Subscription subscription = subscriptionRepository.findByOrganizationId(ctx.orgId())
                .orElseThrow(() -> ApiException.notFound("Subscription not found for organization"));

        SubscriptionPlan effectivePlan = PlanEnforcementService.effectivePlan(ctx);
        PlanLimit limits = PlanLimit.forPlan(effectivePlan);

        return new SubscriptionResponse(
                ctx.orgId(),
                ctx.plan(),
                effectivePlan,
                ctx.status(),
                subscription.getTrialEndsAt(),
                subscription.getCurrentPeriodEnd(),
                computeDaysRemaining(subscription),
                hasBillingAccount(subscription),
                canManageBilling(userId, ctx.orgId()),
                new UsageThisMonth(
                        orgUsageCounter.aiSkillRunsThisMonth(ctx.orgId()),
                        orgUsageCounter.jobApplicationsThisMonth(ctx.orgId())),
                PlanLimitsResponse.from(limits),
                orgUsageCounter.cvUploadsTotal(ctx.orgId()));
    }

    @Transactional(readOnly = true)
    public List<PlanResponse> listPlans() {
        return Arrays.stream(SubscriptionPlan.values())
                .map(plan -> new PlanResponse(
                        plan.name().toLowerCase(),
                        plan.name(),
                        saasBillingProperties.priceFor(plan),
                        "EUR",
                        "month",
                        planFeatures(plan)))
                .toList();
    }

    @Transactional(readOnly = true)
    public UsageMetricsResponse getUsageForUser(UUID userId) {
        SubscriptionResponse subscription = getSubscriptionForUser(userId);
        int aiLimit = subscription.limits().aiRunsPerMonth();
        int appLimit = subscription.limits().applicationsPerMonth();
        return new UsageMetricsResponse(
                subscription.usageThisMonth().aiRuns(),
                aiLimit,
                subscription.usageThisMonth().applications(),
                appLimit,
                monthResetInstant());
    }

    @Transactional
    public void setPrimaryBillingOrganization(UUID userId, UUID organizationId) {
        orgMemberRepository.findByOrgIdAndUserId(organizationId, userId)
                .filter(m -> "active".equals(m.getStatus()))
                .orElseThrow(() -> ApiException.forbidden("Not an active member of that organization"));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));
        user.setPrimaryBillingOrganizationId(organizationId);
        userRepository.save(user);
    }

    private static List<String> planFeatures(SubscriptionPlan plan) {
        PlanLimit limits = PlanLimit.forPlan(plan);
        return switch (plan) {
            case FREE -> List.of(
                    limits.aiSkillRunsPerMonth() + " AI runs per month",
                    limits.jobApplicationsPerMonth() + " job applications",
                    limits.cvUploads() + " CV profile(s)");
            case PRO -> List.of(
                    "200 AI runs per month",
                    "Unlimited job tracking",
                    "10 CV profiles",
                    "Interview Prep Suite");
            case ENTERPRISE -> List.of(
                    "Unlimited AI runs",
                    "Unlimited job tracking",
                    "Unlimited CV profiles",
                    "Priority support");
        };
    }

    private static Instant monthResetInstant() {
        LocalDate firstOfNextMonth = LocalDate.now(ZoneOffset.UTC).plusMonths(1).withDayOfMonth(1);
        return firstOfNextMonth.atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    @Transactional(readOnly = true)
    public List<InvoiceResponse> getInvoicesForUser(UUID userId) {
        SubscriptionContext ctx = subscriptionResolver.resolveForUser(userId);
        assertBillingAdmin(userId, ctx.orgId());

        Subscription subscription = subscriptionRepository.findByOrganizationId(ctx.orgId())
                .orElseThrow(() -> ApiException.notFound("Subscription not found for organization"));

        if (!hasBillingAccount(subscription)) {
            return List.of();
        }

        return stripeGateway.listInvoices(subscription.getStripeCustomerId()).stream()
                .map(this::toInvoiceResponse)
                .toList();
    }

    private InvoiceResponse toInvoiceResponse(StripeInvoiceRecord invoice) {
        return new InvoiceResponse(
                invoice.id(),
                invoice.amountDue(),
                invoice.currency(),
                invoice.status(),
                invoice.createdAt(),
                invoice.pdfUrl());
    }

    private static boolean hasBillingAccount(Subscription subscription) {
        return subscription.getStripeCustomerId() != null && !subscription.getStripeCustomerId().isBlank();
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

        Subscription subscription = subscriptionRepository.findByOrganizationIdForUpdate(ctx.orgId())
                .orElseThrow(() -> ApiException.notFound("Subscription not found for organization"));

        SubscriptionPlan effectivePlan = PlanEnforcementService.effectivePlan(ctx);
        if (effectivePlan != SubscriptionPlan.FREE
                && ctx.status() != SubscriptionStatus.CANCELLED
                && ctx.status() != SubscriptionStatus.PAST_DUE
                && subscription.getStripeSubscriptionId() != null
                && !subscription.getStripeSubscriptionId().isBlank()) {
            throw new ApiException(HttpStatus.CONFLICT,
                    "An active subscription already exists. Use the customer portal to change plans.");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));

        if (subscription.getStripeCustomerId() == null || subscription.getStripeCustomerId().isBlank()) {
            String customerId = stripeGateway.createCustomer(user.getEmail(), ctx.orgId());
            subscription.setStripeCustomerId(customerId);
            subscriptionRepository.saveAndFlush(subscription);
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

        if (result.sessionId() != null && result.sessionId().startsWith("cs_mock_")) {
            String mockSubscriptionId = "sub_mock_" + UUID.randomUUID();
            activateSubscriptionFromCheckout(
                    subscription,
                    plan,
                    subscription.getStripeCustomerId(),
                    mockSubscriptionId);
        }

        return new SessionUrlResponse(result.url());
    }

    @Transactional
    public CancelSubscriptionResponse cancelSubscription(UUID userId) {
        SubscriptionContext ctx = subscriptionResolver.resolveForUser(userId);
        assertBillingAdmin(userId, ctx.orgId());

        Subscription subscription = subscriptionRepository.findByOrganizationId(ctx.orgId())
                .orElseThrow(() -> ApiException.notFound("Subscription not found for organization"));

        SubscriptionPlan effectivePlan = PlanEnforcementService.effectivePlan(ctx);
        if (effectivePlan == SubscriptionPlan.FREE && !hasBillingAccount(subscription)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "No paid subscription to cancel");
        }

        String stripeSubscriptionId = subscription.getStripeSubscriptionId();
        if (stripeSubscriptionId == null || stripeSubscriptionId.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "No active Stripe subscription for this organization");
        }

        if (isMockStripeId(stripeSubscriptionId)) {
            if (subscription.getCurrentPeriodEnd() == null) {
                subscription.setCurrentPeriodEnd(Instant.now().plus(30, ChronoUnit.DAYS));
            }
            subscriptionRepository.save(subscription);
            return new CancelSubscriptionResponse(true, subscription.getCurrentPeriodEnd());
        }

        stripeGateway.cancelSubscriptionAtPeriodEnd(stripeSubscriptionId);
        return new CancelSubscriptionResponse(true, subscription.getCurrentPeriodEnd());
    }

    @Transactional(readOnly = true)
    public SessionUrlResponse createCustomerPortalSession(UUID userId) {
        SubscriptionContext ctx = subscriptionResolver.resolveForUser(userId);
        assertBillingAdmin(userId, ctx.orgId());

        Subscription subscription = subscriptionRepository.findByOrganizationId(ctx.orgId())
                .orElseThrow(() -> ApiException.notFound("Subscription not found for organization"));

        if (!hasBillingAccount(subscription)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "No billing account exists for this organization");
        }

        PortalSessionResult result = stripeGateway.createCustomerPortalSession(
                subscription.getStripeCustomerId(),
                resolvePortalReturnUrl());

        return new SessionUrlResponse(result.url());
    }

    @Transactional
    public WebhookDisposition handleWebhook(byte[] payloadBytes, String signatureHeader) {
        if (payloadBytes == null || payloadBytes.length == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Empty webhook payload");
        }
        if (payloadBytes.length > MAX_WEBHOOK_BYTES) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "Webhook payload too large");
        }
        if (signatureHeader == null || signatureHeader.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Missing Stripe-Signature header");
        }

        String payload = new String(payloadBytes, java.nio.charset.StandardCharsets.UTF_8);
        Event event;
        try {
            event = stripeGateway.constructWebhookEvent(payload, signatureHeader);
        } catch (SignatureVerificationException ex) {
            log.warn("Stripe webhook signature verification failed: {}", ex.getMessage());
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid Stripe signature");
        }

        if (webhookIdempotency.isProcessed(event.getId())) {
            log.debug("Stripe webhook event already processed: {}", event.getId());
            return WebhookDisposition.DUPLICATE;
        }

        WebhookDisposition disposition = dispatchEvent(event);
        webhookIdempotency.markProcessed(event.getId());
        return disposition;
    }

    private WebhookDisposition dispatchEvent(Event event) {
        return switch (event.getType()) {
            case "checkout.session.completed" -> {
                handleCheckoutSessionCompleted(event);
                yield WebhookDisposition.PROCESSED;
            }
            case "customer.subscription.updated" -> {
                handleSubscriptionUpdated(event);
                yield WebhookDisposition.PROCESSED;
            }
            case "customer.subscription.deleted" -> {
                handleSubscriptionDeleted(event);
                yield WebhookDisposition.PROCESSED;
            }
            case "invoice.payment_failed" -> {
                handleInvoicePaymentFailed(event);
                yield WebhookDisposition.PROCESSED;
            }
            case "invoice.paid" -> {
                handleInvoicePaid(event);
                yield WebhookDisposition.PROCESSED;
            }
            default -> {
                log.info("Ignoring unsupported Stripe event type: {}", event.getType());
                yield WebhookDisposition.IGNORED_UNSUPPORTED;
            }
        };
    }

    private void handleCheckoutSessionCompleted(Event event) {
        com.stripe.model.checkout.Session session = deserialize(event, com.stripe.model.checkout.Session.class);
        if (session == null) {
            throw new WebhookProcessingException("checkout.session.completed missing session payload");
        }

        String paymentStatus = session.getPaymentStatus();
        if (paymentStatus != null
                && !"paid".equals(paymentStatus)
                && !"no_payment_required".equals(paymentStatus)) {
            throw new WebhookProcessingException("checkout.session.completed unpaid status=" + paymentStatus);
        }

        String orgIdRaw = session.getMetadata() != null ? session.getMetadata().get("organizationId") : null;
        if (orgIdRaw == null || orgIdRaw.isBlank()) {
            throw new WebhookProcessingException("checkout.session.completed missing organizationId metadata");
        }

        UUID orgId = UUID.fromString(orgIdRaw);
        Subscription subscription = subscriptionRepository.findByOrganizationId(orgId)
                .orElseThrow(() -> new WebhookProcessingException("Subscription missing for org " + orgId));

        SubscriptionPlan plan = resolveCheckoutPlan(session, subscription);

        activateSubscriptionFromCheckout(
                subscription,
                plan,
                session.getCustomer(),
                session.getSubscription());
    }

    private SubscriptionPlan resolveCheckoutPlan(
            com.stripe.model.checkout.Session session,
            Subscription subscription) {
        String metadataPlan = session.getMetadata() != null ? session.getMetadata().get("plan") : null;
        String stripeSubId = session.getSubscription();

        if (stripeSubId == null || stripeSubId.isBlank()) {
            if (metadataPlan != null && !metadataPlan.isBlank()) {
                return SubscriptionPlan.valueOf(metadataPlan);
            }
            return subscription.getPlan();
        }

        SubscriptionPlan stripePlan = stripeGateway.resolveSubscriptionPlan(stripeSubId)
                .map(SubscriptionPlanResolution::plan)
                .orElseThrow(() -> new WebhookProcessingException(
                        "checkout.session.completed could not resolve plan for subscription " + stripeSubId));

        if (metadataPlan != null && !metadataPlan.isBlank()) {
            SubscriptionPlan metadataResolved = SubscriptionPlan.valueOf(metadataPlan);
            if (metadataResolved != stripePlan) {
                log.warn("Checkout metadata plan {} differs from Stripe plan {}; using Stripe",
                        metadataPlan, stripePlan);
            }
        }
        return stripePlan;
    }

    private void activateSubscriptionFromCheckout(
            Subscription subscription,
            SubscriptionPlan plan,
            String customerId,
            String subscriptionId) {
        SubscriptionPlan previousPlan = subscription.getPlan();

        if (customerId != null && !customerId.isBlank()) {
            subscription.setStripeCustomerId(customerId);
        }
        if (subscriptionId != null && !subscriptionId.isBlank()) {
            subscription.setStripeSubscriptionId(subscriptionId);
            Optional<Long> periodEnd = stripeGateway.retrieveSubscriptionCurrentPeriodEnd(subscriptionId);
            if (periodEnd.isPresent()) {
                subscription.setCurrentPeriodEnd(Instant.ofEpochSecond(periodEnd.get()));
            } else if (isMockStripeId(subscriptionId)) {
                subscription.setCurrentPeriodEnd(Instant.now().plus(30, ChronoUnit.DAYS));
            } else {
                log.warn("Stripe subscription {} has no current_period_end; leaving period end unset", subscriptionId);
            }
        }
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setPlan(plan);
        if (subscription.getCurrentPeriodEnd() == null && isMockStripeId(
                subscription.getStripeSubscriptionId() != null ? subscription.getStripeSubscriptionId() : "")) {
            subscription.setCurrentPeriodEnd(Instant.now().plus(30, ChronoUnit.DAYS));
        }

        subscriptionRepository.save(subscription);
        trackPlanChangeForOrg(subscription.getOrganizationId(), previousPlan, subscription.getPlan());
    }

    private void handleSubscriptionUpdated(Event event) {
        com.stripe.model.Subscription stripeSubscription =
                deserialize(event, com.stripe.model.Subscription.class);
        if (stripeSubscription == null) {
            throw new WebhookProcessingException("customer.subscription.updated missing subscription payload");
        }

        Subscription subscription = subscriptionRepository.findByStripeSubscriptionId(stripeSubscription.getId())
                .orElseGet(() -> resolveSubscriptionFromCustomer(stripeSubscription.getCustomer()));

        if (subscription == null) {
            throw new WebhookProcessingException("No local subscription for Stripe subscription "
                    + stripeSubscription.getId());
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
            throw new WebhookProcessingException("customer.subscription.deleted missing subscription payload");
        }

        subscriptionRepository.findByStripeSubscriptionId(stripeSubscription.getId())
                .ifPresent(subscription -> {
                    SubscriptionPlan previousPlan = subscription.getPlan();
                    subscription.setStatus(SubscriptionStatus.CANCELLED);
                    subscription.setPlan(SubscriptionPlan.FREE);
                    subscription.setStripeSubscriptionId(null);
                    subscription.setCurrentPeriodEnd(null);
                    subscriptionRepository.save(subscription);
                    trackPlanChangeForOrg(subscription.getOrganizationId(), previousPlan, subscription.getPlan());
                });
    }

    private void handleInvoicePaymentFailed(Event event) {
        com.stripe.model.Invoice invoice = deserialize(event, com.stripe.model.Invoice.class);
        if (invoice == null) {
            throw new WebhookProcessingException("invoice.payment_failed missing invoice payload");
        }
        markPastDueFromCustomer(invoice.getCustomer());
    }

    private void handleInvoicePaid(Event event) {
        com.stripe.model.Invoice invoice = deserialize(event, com.stripe.model.Invoice.class);
        if (invoice == null) {
            throw new WebhookProcessingException("invoice.paid missing invoice payload");
        }
        subscriptionRepository.findByStripeCustomerId(invoice.getCustomer())
                .filter(sub -> sub.getStatus() == SubscriptionStatus.PAST_DUE)
                .ifPresent(sub -> {
                    sub.setStatus(SubscriptionStatus.ACTIVE);
                    subscriptionRepository.save(sub);
                });
    }

    private void markPastDueFromCustomer(String customerId) {
        if (customerId == null || customerId.isBlank()) {
            throw new WebhookProcessingException("invoice event missing customer id");
        }
        subscriptionRepository.findByStripeCustomerId(customerId)
                .ifPresent(sub -> {
                    sub.setStatus(SubscriptionStatus.PAST_DUE);
                    subscriptionRepository.save(sub);
                });
    }

    private void trackPlanChangeForOrg(UUID orgId, SubscriptionPlan fromPlan, SubscriptionPlan toPlan) {
        organizationPlanSyncService.syncFromSubscription(orgId, toPlan);
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
            planMapper.resolvePlanForPriceId(priceId).ifPresent(subscription::setPlan);
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
        if (!canManageBilling(userId, orgId)) {
            throw ApiException.forbidden("Only organization owners or admins can manage billing");
        }
    }

    private boolean canManageBilling(UUID userId, UUID orgId) {
        return orgMemberRepository.findByOrgIdAndUserId(orgId, userId)
                .filter(m -> "active".equals(m.getStatus()))
                .map(m -> "owner".equals(m.getRole()) || "admin".equals(m.getRole()))
                .orElse(false);
    }

    private String resolveSuccessUrl() {
        String configured = stripeProperties.getCheckout().getSuccessUrl();
        if (configured != null && !configured.isBlank()) {
            return configured;
        }
        return billingFrontendBaseUrl() + "/billing/success";
    }

    private String resolveCancelUrl() {
        String configured = stripeProperties.getCheckout().getCancelUrl();
        if (configured != null && !configured.isBlank()) {
            return configured;
        }
        return billingFrontendBaseUrl() + "/billing/cancel";
    }

    private String resolvePortalReturnUrl() {
        String configured = stripeProperties.getPortalReturnUrl();
        if (configured != null && !configured.isBlank()) {
            return configured;
        }
        return billingFrontendBaseUrl() + "/account/billing";
    }

    private String billingFrontendBaseUrl() {
        String configured = stripeProperties.getFrontendBaseUrl();
        if (configured != null && !configured.isBlank()) {
            return trimTrailingSlash(configured);
        }
        if (corsAllowedOrigins != null && !corsAllowedOrigins.isBlank()) {
            for (String origin : corsAllowedOrigins.split(",")) {
                String trimmed = origin.trim();
                if (trimmed.contains(":5173") || trimmed.contains(":5174")) {
                    return trimmed;
                }
            }
            for (String origin : corsAllowedOrigins.split(",")) {
                String trimmed = origin.trim();
                if (!trimmed.contains(":4000")) {
                    return trimmed;
                }
            }
            return corsAllowedOrigins.split(",")[0].trim();
        }
        return "http://localhost:5173";
    }

    private static String trimTrailingSlash(String url) {
        if (url.endsWith("/")) {
            return url.substring(0, url.length() - 1);
        }
        return url;
    }

    private static boolean isMockStripeId(String id) {
        return id.startsWith("sub_mock_") || id.startsWith("cus_mock_");
    }
}
