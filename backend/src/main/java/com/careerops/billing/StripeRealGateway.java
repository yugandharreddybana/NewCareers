package com.careerops.billing;

import com.careerops.exception.BillingGatewayException;
import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.net.Webhook;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.InvoiceListParams;
import com.stripe.param.SubscriptionUpdateParams;
import com.stripe.param.checkout.SessionCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Component
@Profile("prod")
public class StripeRealGateway implements StripeGateway {

    private static final Logger log = LoggerFactory.getLogger(StripeRealGateway.class);

    private final StripeProperties properties;
    private final StripePlanMapper planMapper;

    public StripeRealGateway(StripeProperties properties, StripePlanMapper planMapper) {
        this.properties = properties;
        this.planMapper = planMapper;
    }

    @PostConstruct
    void init() {
        Stripe.apiKey = properties.getSecretKey();
    }

    @Override
    public String createCustomer(String email, UUID organizationId) {
        try {
            com.stripe.model.Customer customer = com.stripe.model.Customer.create(
                    CustomerCreateParams.builder()
                            .setEmail(email)
                            .putMetadata("organizationId", organizationId.toString())
                            .build());
            return customer.getId();
        } catch (Exception e) {
            log.error("Stripe createCustomer failed orgId={}", organizationId, e);
            throw new BillingGatewayException("Failed to create Stripe customer", HttpStatus.BAD_GATEWAY, e);
        }
    }

    @Override
    public CheckoutSessionResult createCheckoutSession(
            String customerId,
            String priceId,
            String successUrl,
            String cancelUrl,
            Map<String, String> metadata) {
        try {
            SessionCreateParams.Builder builder = SessionCreateParams.builder()
                    .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
                    .setCustomer(customerId)
                    .setSuccessUrl(successUrl)
                    .setCancelUrl(cancelUrl)
                    .addLineItem(SessionCreateParams.LineItem.builder()
                            .setPrice(priceId)
                            .setQuantity(1L)
                            .build());
            metadata.forEach(builder::putMetadata);

            com.stripe.model.checkout.Session session =
                    com.stripe.model.checkout.Session.create(builder.build());
            return new CheckoutSessionResult(session.getUrl(), session.getId());
        } catch (Exception e) {
            log.error("Stripe createCheckoutSession failed customerId={}", customerId, e);
            throw new BillingGatewayException("Failed to create Stripe checkout session", HttpStatus.BAD_GATEWAY, e);
        }
    }

    @Override
    public PortalSessionResult createCustomerPortalSession(String customerId, String returnUrl) {
        try {
            com.stripe.model.billingportal.Session portal =
                    com.stripe.model.billingportal.Session.create(
                    com.stripe.param.billingportal.SessionCreateParams.builder()
                            .setCustomer(customerId)
                            .setReturnUrl(returnUrl)
                            .build());
            return new PortalSessionResult(portal.getUrl());
        } catch (Exception e) {
            log.error("Stripe createCustomerPortalSession failed customerId={}", customerId, e);
            throw new BillingGatewayException("Failed to create Stripe customer portal session", HttpStatus.BAD_GATEWAY, e);
        }
    }

    @Override
    public void cancelSubscriptionAtPeriodEnd(String stripeSubscriptionId) {
        try {
            com.stripe.model.Subscription subscription =
                    com.stripe.model.Subscription.retrieve(stripeSubscriptionId);
            subscription.update(SubscriptionUpdateParams.builder()
                    .setCancelAtPeriodEnd(true)
                    .build());
        } catch (Exception e) {
            log.error("Stripe cancelSubscriptionAtPeriodEnd failed subId={}", stripeSubscriptionId, e);
            throw new BillingGatewayException("Failed to cancel Stripe subscription", HttpStatus.BAD_GATEWAY, e);
        }
    }

    @Override
    public void cancelSubscriptionImmediately(String stripeSubscriptionId) {
        try {
            com.stripe.model.Subscription subscription =
                    com.stripe.model.Subscription.retrieve(stripeSubscriptionId);
            subscription.cancel();
        } catch (Exception e) {
            log.error("Stripe cancelSubscriptionImmediately failed subId={}", stripeSubscriptionId, e);
            throw new BillingGatewayException("Failed to cancel Stripe subscription immediately", HttpStatus.BAD_GATEWAY, e);
        }
    }

    @Override
    public void deleteCustomer(String stripeCustomerId) {
        try {
            com.stripe.model.Customer customer = com.stripe.model.Customer.retrieve(stripeCustomerId);
            customer.delete();
        } catch (Exception e) {
            log.error("Stripe deleteCustomer failed customerId={}", stripeCustomerId, e);
            throw new BillingGatewayException("Failed to delete Stripe customer", HttpStatus.BAD_GATEWAY, e);
        }
    }

    @Override
    public List<StripeInvoiceRecord> listInvoices(String stripeCustomerId) {
        try {
            com.stripe.model.InvoiceCollection invoices = com.stripe.model.Invoice.list(
                    InvoiceListParams.builder()
                            .setCustomer(stripeCustomerId)
                            .setLimit(24L)
                            .build());
            return invoices.getData().stream()
                    .map(invoice -> new StripeInvoiceRecord(
                            invoice.getId(),
                            invoice.getAmountDue() != null ? invoice.getAmountDue() : 0L,
                            invoice.getCurrency() != null ? invoice.getCurrency() : "usd",
                            invoice.getStatus() != null ? invoice.getStatus() : "unknown",
                            invoice.getCreated() != null
                                    ? Instant.ofEpochSecond(invoice.getCreated())
                                    : Instant.now(),
                            invoice.getInvoicePdf()))
                    .toList();
        } catch (Exception e) {
            log.error("Stripe listInvoices failed customerId={}", stripeCustomerId, e);
            throw new BillingGatewayException("Failed to list Stripe invoices", HttpStatus.BAD_GATEWAY, e);
        }
    }

    @Override
    public Optional<Long> retrieveSubscriptionCurrentPeriodEnd(String stripeSubscriptionId) {
        try {
            com.stripe.model.Subscription subscription =
                    com.stripe.model.Subscription.retrieve(stripeSubscriptionId);
            Long end = subscription.getCurrentPeriodEnd();
            return end != null ? Optional.of(end) : Optional.empty();
        } catch (Exception e) {
            log.error("Stripe retrieveSubscriptionCurrentPeriodEnd failed subId={}", stripeSubscriptionId, e);
            return Optional.empty();
        }
    }

    @Override
    public Optional<Long> retrieveSubscriptionCurrentPeriodStart(String stripeSubscriptionId) {
        try {
            com.stripe.model.Subscription subscription =
                    com.stripe.model.Subscription.retrieve(stripeSubscriptionId);
            Long start = subscription.getCurrentPeriodStart();
            return start != null ? Optional.of(start) : Optional.empty();
        } catch (Exception e) {
            log.error("Stripe retrieveSubscriptionCurrentPeriodStart failed subId={}", stripeSubscriptionId, e);
            return Optional.empty();
        }
    }

    @Override
    public Optional<SubscriptionPlanResolution> resolveSubscriptionPlan(String stripeSubscriptionId) {
        try {
            com.stripe.model.Subscription subscription =
                    com.stripe.model.Subscription.retrieve(stripeSubscriptionId);
            if (subscription.getItems() == null
                    || subscription.getItems().getData() == null
                    || subscription.getItems().getData().isEmpty()
                    || subscription.getItems().getData().getFirst().getPrice() == null) {
                return Optional.empty();
            }
            String priceId = subscription.getItems().getData().getFirst().getPrice().getId();
            return planMapper.resolvePlanForPriceId(priceId)
                    .map(plan -> new SubscriptionPlanResolution(plan, subscription.getCurrentPeriodEnd()));
        } catch (Exception e) {
            log.error("Stripe resolveSubscriptionPlan failed subId={}", stripeSubscriptionId, e);
            return Optional.empty();
        }
    }

    @Override
    public Event constructWebhookEvent(String payload, String signatureHeader)
            throws SignatureVerificationException {
        return Webhook.constructEvent(payload, signatureHeader, properties.getWebhookSecret());
    }
}
