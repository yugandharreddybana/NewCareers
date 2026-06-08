package com.careerops.service;

import com.careerops.config.SaasBillingProperties;
import com.careerops.billing.BillingWebhookIdempotency;
import com.careerops.billing.CheckoutSessionResult;
import com.careerops.billing.PortalSessionResult;
import com.careerops.billing.StripeGateway;
import com.careerops.billing.StripePlanMapper;
import com.careerops.billing.StripeProperties;
import com.careerops.billing.SubscriptionPlanResolution;
import com.careerops.dto.BillingDtos.SessionUrlResponse;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BillingServiceTest {

    @Mock OrganizationSubscriptionResolver subscriptionResolver;
    @Mock SubscriptionRepository subscriptionRepository;
    @Mock OrgMemberRepository orgMemberRepository;
    @Mock UserRepository userRepository;
    @Mock StripeGateway stripeGateway;
    @Mock StripePlanMapper planMapper;
    @Mock BillingWebhookIdempotency webhookIdempotency;
    @Mock OrgUsageCounter orgUsageCounter;
    @Mock SaasLifecycleTelemetry lifecycleTelemetry;
    @Mock SaasBillingProperties saasBillingProperties;
    @Mock OrganizationPlanSyncService organizationPlanSyncService;

    StripeProperties stripeProperties = new StripeProperties();

    @InjectMocks BillingService billingService;

    UUID userId = UUID.randomUUID();
    UUID orgId = UUID.randomUUID();
    UUID subscriptionId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        stripeProperties.getPriceId().setPro("price_pro_test");
        stripeProperties.getPriceId().setEnterprise("price_ent_test");
        billingService = new BillingService(
                subscriptionResolver,
                subscriptionRepository,
                orgMemberRepository,
                userRepository,
                stripeGateway,
                stripeProperties,
                planMapper,
                webhookIdempotency,
                orgUsageCounter,
                lifecycleTelemetry,
                saasBillingProperties,
                organizationPlanSyncService,
                "http://localhost:5173,http://localhost:4000");
    }

    @Test
    @DisplayName("createCheckoutSession creates Stripe customer when missing")
    void createCheckoutSessionCreatesCustomer() {
        Subscription subscription = subscription(orgId, null, null);
        when(subscriptionResolver.resolveForUser(userId))
                .thenReturn(new SubscriptionContext(orgId, subscriptionId, SubscriptionPlan.FREE, SubscriptionStatus.TRIALING, null));
        when(orgMemberRepository.findByOrgIdAndUserId(orgId, userId))
                .thenReturn(Optional.of(ownerMember()));
        when(subscriptionRepository.findByOrganizationIdForUpdate(orgId)).thenReturn(Optional.of(subscription));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user("owner@example.com")));
        when(stripeGateway.createCustomer("owner@example.com", orgId)).thenReturn("cus_new");
        when(planMapper.priceIdForPlan(SubscriptionPlan.PRO)).thenReturn("price_pro_test");
        when(stripeGateway.createCheckoutSession(
                eq("cus_new"),
                eq("price_pro_test"),
                eq("http://localhost:5173/billing/success"),
                eq("http://localhost:5173/billing/cancel"),
                any()))
                .thenReturn(new CheckoutSessionResult("https://checkout.example/session", "cs_test"));

        SessionUrlResponse response = billingService.createCheckoutSession(userId, SubscriptionPlan.PRO);

        assertThat(response.url()).isEqualTo("https://checkout.example/session");
        assertThat(subscription.getStripeCustomerId()).isEqualTo("cus_new");
        verify(subscriptionRepository).saveAndFlush(subscription);
    }

    @Test
    @DisplayName("createCustomerPortalSession requires existing Stripe customer")
    void createCustomerPortalRequiresCustomer() {
        Subscription subscription = subscription(orgId, null, null);
        when(subscriptionResolver.resolveForUser(userId))
                .thenReturn(new SubscriptionContext(orgId, subscriptionId, SubscriptionPlan.FREE, SubscriptionStatus.TRIALING, null));
        when(orgMemberRepository.findByOrgIdAndUserId(orgId, userId))
                .thenReturn(Optional.of(ownerMember()));
        when(subscriptionRepository.findByOrganizationId(orgId)).thenReturn(Optional.of(subscription));

        assertThatThrownBy(() -> billingService.createCustomerPortalSession(userId))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("No billing account");
    }

    @Test
    @DisplayName("non-admin member cannot create checkout session")
    void createCheckoutSessionForbiddenForMember() {
        when(subscriptionResolver.resolveForUser(userId))
                .thenReturn(new SubscriptionContext(orgId, subscriptionId, SubscriptionPlan.FREE, SubscriptionStatus.TRIALING, null));
        when(orgMemberRepository.findByOrgIdAndUserId(orgId, userId))
                .thenReturn(Optional.of(member("member")));

        assertThatThrownBy(() -> billingService.createCheckoutSession(userId, SubscriptionPlan.PRO))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("owners or admins");
    }

    @Test
    @DisplayName("duplicate webhook event is ignored when already processed")
    void duplicateWebhookIgnored() throws Exception {
        Event event = Event.GSON.fromJson("""
                {"id":"evt_dup","type":"checkout.session.completed","data":{"object":{}}}
                """, Event.class);
        when(stripeGateway.constructWebhookEvent(any(), eq("mock"))).thenReturn(event);
        when(webhookIdempotency.isProcessed("evt_dup")).thenReturn(true);

        billingService.handleWebhook("{}".getBytes(StandardCharsets.UTF_8), "mock");

        verify(subscriptionRepository, never()).save(any());
        verify(webhookIdempotency, never()).markProcessed(any());
    }

    @Test
    @DisplayName("checkout.session.completed activates subscription from metadata")
    void checkoutSessionCompletedActivatesSubscription() throws Exception {
        String payload = """
                {
                  "id": "evt_checkout",
                  "type": "checkout.session.completed",
                  "data": {
                    "object": {
                      "id": "cs_test",
                      "object": "checkout.session",
                      "payment_status": "paid",
                      "customer": "cus_abc",
                      "subscription": "sub_abc",
                      "metadata": {
                        "organizationId": "%s",
                        "plan": "PRO"
                      }
                    }
                  }
                }
                """.formatted(orgId);
        Event event = Event.GSON.fromJson(payload, Event.class);
        Subscription subscription = subscription(orgId, null, null);

        when(stripeGateway.constructWebhookEvent(payload, "mock")).thenReturn(event);
        when(webhookIdempotency.isProcessed("evt_checkout")).thenReturn(false);
        when(subscriptionRepository.findByOrganizationId(orgId)).thenReturn(Optional.of(subscription));
        when(stripeGateway.resolveSubscriptionPlan("sub_abc"))
                .thenReturn(Optional.of(new SubscriptionPlanResolution(SubscriptionPlan.PRO, 1_900_000_000L)));
        when(stripeGateway.retrieveSubscriptionCurrentPeriodEnd("sub_abc"))
                .thenReturn(Optional.of(1_900_000_000L));

        billingService.handleWebhook(payload.getBytes(StandardCharsets.UTF_8), "mock");

        assertThat(subscription.getStripeCustomerId()).isEqualTo("cus_abc");
        assertThat(subscription.getStripeSubscriptionId()).isEqualTo("sub_abc");
        assertThat(subscription.getStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
        assertThat(subscription.getPlan()).isEqualTo(SubscriptionPlan.PRO);
        verify(subscriptionRepository).save(subscription);
        verify(webhookIdempotency).markProcessed("evt_checkout");
    }

    @Test
    @DisplayName("createCustomerPortalSession returns portal URL for billing admin")
    void createCustomerPortalSessionSuccess() {
        Subscription subscription = subscription(orgId, "cus_existing", null);
        when(subscriptionResolver.resolveForUser(userId))
                .thenReturn(new SubscriptionContext(orgId, subscriptionId, SubscriptionPlan.PRO, SubscriptionStatus.ACTIVE, null));
        when(orgMemberRepository.findByOrgIdAndUserId(orgId, userId))
                .thenReturn(Optional.of(adminMember()));
        when(subscriptionRepository.findByOrganizationId(orgId)).thenReturn(Optional.of(subscription));
        when(stripeGateway.createCustomerPortalSession("cus_existing", "http://localhost:5173/account/billing"))
                .thenReturn(new PortalSessionResult("https://billing.stripe.com/portal"));

        SessionUrlResponse response = billingService.createCustomerPortalSession(userId);

        assertThat(response.url()).isEqualTo("https://billing.stripe.com/portal");
    }

    @Test
    @DisplayName("mock checkout session activates subscription immediately")
    void mockCheckoutActivatesSubscription() {
        Subscription subscription = subscription(orgId, "cus_mock_abc", null);
        when(subscriptionResolver.resolveForUser(userId))
                .thenReturn(new SubscriptionContext(orgId, subscriptionId, SubscriptionPlan.FREE, SubscriptionStatus.TRIALING, null));
        when(orgMemberRepository.findByOrgIdAndUserId(orgId, userId))
                .thenReturn(Optional.of(ownerMember()));
        when(subscriptionRepository.findByOrganizationIdForUpdate(orgId)).thenReturn(Optional.of(subscription));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user("owner@example.com")));
        when(planMapper.priceIdForPlan(SubscriptionPlan.PRO)).thenReturn("price_pro_test");
        when(stripeGateway.createCheckoutSession(
                eq("cus_mock_abc"),
                eq("price_pro_test"),
                any(),
                any(),
                any()))
                .thenReturn(new CheckoutSessionResult("http://localhost:5173/billing/success?mock=1", "cs_mock_test"));

        billingService.createCheckoutSession(userId, SubscriptionPlan.PRO);

        assertThat(subscription.getStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
        assertThat(subscription.getPlan()).isEqualTo(SubscriptionPlan.PRO);
        assertThat(subscription.getStripeSubscriptionId()).startsWith("sub_mock_");
        verify(subscriptionRepository).save(subscription);
    }

    @Test
    @DisplayName("cancelSubscription schedules mock subscription at period end")
    void cancelSubscriptionMock() {
        Subscription subscription = subscription(orgId, "cus_mock_abc", "sub_mock_abc");
        subscription.setPlan(SubscriptionPlan.PRO);
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        when(subscriptionResolver.resolveForUser(userId))
                .thenReturn(new SubscriptionContext(orgId, subscriptionId, SubscriptionPlan.PRO, SubscriptionStatus.ACTIVE, null));
        when(orgMemberRepository.findByOrgIdAndUserId(orgId, userId))
                .thenReturn(Optional.of(ownerMember()));
        when(subscriptionRepository.findByOrganizationId(orgId)).thenReturn(Optional.of(subscription));

        var response = billingService.cancelSubscription(userId);

        assertThat(response.cancelAtPeriodEnd()).isTrue();
        assertThat(response.currentPeriodEnd()).isNotNull();
        verify(subscriptionRepository).save(subscription);
        verify(stripeGateway, never()).cancelSubscriptionAtPeriodEnd(any());
    }

    @Test
    @DisplayName("cancelSubscription calls Stripe for real subscription ids")
    void cancelSubscriptionRealStripe() {
        Subscription subscription = subscription(orgId, "cus_live", "sub_live_abc");
        subscription.setPlan(SubscriptionPlan.PRO);
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        when(subscriptionResolver.resolveForUser(userId))
                .thenReturn(new SubscriptionContext(orgId, subscriptionId, SubscriptionPlan.PRO, SubscriptionStatus.ACTIVE, null));
        when(orgMemberRepository.findByOrgIdAndUserId(orgId, userId))
                .thenReturn(Optional.of(adminMember()));
        when(subscriptionRepository.findByOrganizationId(orgId)).thenReturn(Optional.of(subscription));

        var response = billingService.cancelSubscription(userId);

        assertThat(response.cancelAtPeriodEnd()).isTrue();
        verify(stripeGateway).cancelSubscriptionAtPeriodEnd("sub_live_abc");
    }

    @Test
    @DisplayName("webhook rejects invalid Stripe signature")
    void webhookInvalidSignature() throws Exception {
        when(stripeGateway.constructWebhookEvent(any(), eq("bad")))
                .thenThrow(new SignatureVerificationException("bad sig", "sig"));

        assertThatThrownBy(() -> billingService.handleWebhook("{}".getBytes(StandardCharsets.UTF_8), "bad"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Invalid Stripe signature");
    }

    @Test
    @DisplayName("webhook rejects missing signature header")
    void webhookMissingSignature() {
        assertThatThrownBy(() -> billingService.handleWebhook("{}".getBytes(StandardCharsets.UTF_8), null))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Missing Stripe-Signature");
    }

    @Test
    @DisplayName("customer.subscription.updated syncs plan and status")
    void subscriptionUpdatedWebhook() throws Exception {
        String payload = """
                {
                  "id": "evt_sub_updated",
                  "type": "customer.subscription.updated",
                  "data": {
                    "object": {
                      "id": "sub_live_abc",
                      "object": "subscription",
                      "customer": "cus_abc",
                      "status": "active",
                      "current_period_end": 1900000000,
                      "items": {
                        "data": [{
                          "price": { "id": "price_pro_test" }
                        }]
                      }
                    }
                  }
                }
                """;
        Event event = Event.GSON.fromJson(payload, Event.class);
        Subscription subscription = subscription(orgId, "cus_abc", "sub_live_abc");
        subscription.setPlan(SubscriptionPlan.FREE);

        when(stripeGateway.constructWebhookEvent(payload, "mock")).thenReturn(event);
        when(webhookIdempotency.isProcessed("evt_sub_updated")).thenReturn(false);
        when(subscriptionRepository.findByStripeSubscriptionId("sub_live_abc"))
                .thenReturn(Optional.of(subscription));
        when(planMapper.mapStripeStatus("active")).thenReturn(SubscriptionStatus.ACTIVE);
        when(planMapper.resolvePlanForPriceId("price_pro_test")).thenReturn(Optional.of(SubscriptionPlan.PRO));

        billingService.handleWebhook(payload.getBytes(StandardCharsets.UTF_8), "mock");

        assertThat(subscription.getPlan()).isEqualTo(SubscriptionPlan.PRO);
        assertThat(subscription.getStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
        verify(subscriptionRepository).save(subscription);
        verify(webhookIdempotency).markProcessed("evt_sub_updated");
    }

    @Test
    @DisplayName("customer.subscription.deleted downgrades to FREE")
    void subscriptionDeletedWebhook() throws Exception {
        String payload = """
                {
                  "id": "evt_sub_deleted",
                  "type": "customer.subscription.deleted",
                  "data": {
                    "object": {
                      "id": "sub_live_abc",
                      "object": "subscription",
                      "customer": "cus_abc",
                      "status": "canceled"
                    }
                  }
                }
                """;
        Event event = Event.GSON.fromJson(payload, Event.class);
        Subscription subscription = subscription(orgId, "cus_abc", "sub_live_abc");
        subscription.setPlan(SubscriptionPlan.PRO);
        subscription.setStatus(SubscriptionStatus.ACTIVE);

        when(stripeGateway.constructWebhookEvent(payload, "mock")).thenReturn(event);
        when(webhookIdempotency.isProcessed("evt_sub_deleted")).thenReturn(false);
        when(subscriptionRepository.findByStripeSubscriptionId("sub_live_abc"))
                .thenReturn(Optional.of(subscription));

        billingService.handleWebhook(payload.getBytes(StandardCharsets.UTF_8), "mock");

        assertThat(subscription.getPlan()).isEqualTo(SubscriptionPlan.FREE);
        assertThat(subscription.getStatus()).isEqualTo(SubscriptionStatus.CANCELLED);
        assertThat(subscription.getStripeSubscriptionId()).isNull();
        verify(subscriptionRepository).save(subscription);
        verify(webhookIdempotency).markProcessed("evt_sub_deleted");
    }

    @Test
    @DisplayName("getSubscriptionForUser returns effective plan and monthly usage")
    void getSubscriptionForUser() {
        Subscription subscription = subscription(orgId, "cus_1", null);
        subscription.setTrialEndsAt(java.time.Instant.parse("2099-07-01T00:00:00Z"));
        subscription.setCurrentPeriodEnd(java.time.Instant.parse("2026-07-15T00:00:00Z"));

        when(subscriptionResolver.resolveForUser(userId))
                .thenReturn(new SubscriptionContext(
                        orgId,
                        subscriptionId,
                        SubscriptionPlan.FREE,
                        SubscriptionStatus.TRIALING,
                        subscription.getTrialEndsAt()));
        when(subscriptionRepository.findByOrganizationId(orgId)).thenReturn(Optional.of(subscription));
        when(orgUsageCounter.aiSkillRunsThisMonth(orgId)).thenReturn(3L);
        when(orgUsageCounter.jobApplicationsThisMonth(orgId)).thenReturn(5L);
        when(orgUsageCounter.cvUploadsTotal(orgId)).thenReturn(1L);

        var response = billingService.getSubscriptionForUser(userId);

        assertThat(response.plan()).isEqualTo(SubscriptionPlan.FREE);
        assertThat(response.effectivePlan()).isEqualTo(SubscriptionPlan.PRO);
        assertThat(response.status()).isEqualTo(SubscriptionStatus.TRIALING);
        assertThat(response.hasBillingAccount()).isTrue();
        assertThat(response.usageThisMonth().aiRuns()).isEqualTo(3L);
        assertThat(response.usageThisMonth().applications()).isEqualTo(5L);
        assertThat(response.cvUploadsTotal()).isEqualTo(1L);
    }

    private Subscription subscription(UUID organizationId, String customerId, String subscriptionId) {
        Subscription subscription = new Subscription();
        subscription.setId(this.subscriptionId);
        subscription.setOrganizationId(organizationId);
        subscription.setStripeCustomerId(customerId);
        subscription.setStripeSubscriptionId(subscriptionId);
        subscription.setPlan(SubscriptionPlan.FREE);
        subscription.setStatus(SubscriptionStatus.TRIALING);
        return subscription;
    }

    private User user(String email) {
        User user = new User();
        user.setId(userId);
        user.setEmail(email);
        return user;
    }

    private OrgMember ownerMember() {
        return member("owner");
    }

    private OrgMember adminMember() {
        return member("admin");
    }

    private OrgMember member(String role) {
        OrgMember member = new OrgMember();
        member.setOrgId(orgId);
        member.setUserId(userId);
        member.setRole(role);
        return member;
    }
}
