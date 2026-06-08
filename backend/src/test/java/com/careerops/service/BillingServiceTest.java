package com.careerops.service;

import com.careerops.billing.BillingWebhookIdempotency;
import com.careerops.billing.CheckoutSessionResult;
import com.careerops.billing.PortalSessionResult;
import com.careerops.billing.StripeGateway;
import com.careerops.billing.StripePlanMapper;
import com.careerops.billing.StripeProperties;
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
import com.stripe.model.Event;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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
                "http://localhost:4000");
    }

    @Test
    @DisplayName("createCheckoutSession creates Stripe customer when missing")
    void createCheckoutSessionCreatesCustomer() {
        Subscription subscription = subscription(orgId, null, null);
        when(subscriptionResolver.resolveForUser(userId))
                .thenReturn(new SubscriptionContext(orgId, subscriptionId, SubscriptionPlan.FREE, SubscriptionStatus.TRIALING, null));
        when(orgMemberRepository.findByOrgIdAndUserId(orgId, userId))
                .thenReturn(Optional.of(ownerMember()));
        when(subscriptionRepository.findByOrganizationId(orgId)).thenReturn(Optional.of(subscription));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user("owner@example.com")));
        when(stripeGateway.createCustomer("owner@example.com", orgId)).thenReturn("cus_new");
        when(planMapper.priceIdForPlan(SubscriptionPlan.PRO)).thenReturn("price_pro_test");
        when(stripeGateway.createCheckoutSession(
                eq("cus_new"),
                eq("price_pro_test"),
                any(),
                any(),
                any()))
                .thenReturn(new CheckoutSessionResult("https://checkout.example/session", "cs_test"));

        SessionUrlResponse response = billingService.createCheckoutSession(userId, SubscriptionPlan.PRO);

        assertThat(response.url()).isEqualTo("https://checkout.example/session");
        assertThat(subscription.getStripeCustomerId()).isEqualTo("cus_new");
        verify(subscriptionRepository).save(subscription);
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
    @DisplayName("duplicate webhook event is ignored after idempotency acquire fails")
    void duplicateWebhookIgnored() throws Exception {
        Event event = Event.GSON.fromJson("""
                {"id":"evt_dup","type":"checkout.session.completed","data":{"object":{}}}
                """, Event.class);
        when(stripeGateway.constructWebhookEvent(any(), eq("mock"))).thenReturn(event);
        when(webhookIdempotency.acquire("evt_dup")).thenReturn(false);

        billingService.handleWebhook("{}", "mock");

        verify(subscriptionRepository, never()).save(any());
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
        when(webhookIdempotency.acquire("evt_checkout")).thenReturn(true);
        when(subscriptionRepository.findByOrganizationId(orgId)).thenReturn(Optional.of(subscription));

        billingService.handleWebhook(payload, "mock");

        assertThat(subscription.getStripeCustomerId()).isEqualTo("cus_abc");
        assertThat(subscription.getStripeSubscriptionId()).isEqualTo("sub_abc");
        assertThat(subscription.getStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
        assertThat(subscription.getPlan()).isEqualTo(SubscriptionPlan.PRO);
        verify(subscriptionRepository).save(subscription);
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
        when(stripeGateway.createCustomerPortalSession("cus_existing", "http://localhost:4000/billing"))
                .thenReturn(new PortalSessionResult("https://billing.stripe.com/portal"));

        SessionUrlResponse response = billingService.createCustomerPortalSession(userId);

        assertThat(response.url()).isEqualTo("https://billing.stripe.com/portal");
    }

    @Test
    @DisplayName("getSubscriptionForUser returns plan and trial metadata")
    void getSubscriptionForUser() {
        Subscription subscription = subscription(orgId, "cus_1", null);
        subscription.setTrialEndsAt(java.time.Instant.parse("2026-07-01T00:00:00Z"));
        subscription.setCurrentPeriodEnd(java.time.Instant.parse("2026-07-15T00:00:00Z"));

        when(subscriptionResolver.resolveForUser(userId))
                .thenReturn(new SubscriptionContext(orgId, subscriptionId, SubscriptionPlan.PRO, SubscriptionStatus.TRIALING, subscription.getTrialEndsAt()));
        when(subscriptionRepository.findByOrganizationId(orgId)).thenReturn(Optional.of(subscription));
        when(orgUsageCounter.aiSkillRunsThisMonth(orgId)).thenReturn(3L);
        when(orgUsageCounter.jobApplicationsThisMonth(orgId)).thenReturn(5L);

        var response = billingService.getSubscriptionForUser(userId);

        assertThat(response.plan()).isEqualTo(SubscriptionPlan.PRO);
        assertThat(response.status()).isEqualTo(SubscriptionStatus.TRIALING);
        assertThat(response.trialEndsAt()).isEqualTo(subscription.getTrialEndsAt());
        assertThat(response.currentPeriodEnd()).isEqualTo(subscription.getCurrentPeriodEnd());
        assertThat(response.usageThisMonth().aiRuns()).isEqualTo(3L);
        assertThat(response.usageThisMonth().applications()).isEqualTo(5L);
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
