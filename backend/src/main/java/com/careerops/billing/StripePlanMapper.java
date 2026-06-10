package com.careerops.billing;

import com.careerops.model.SubscriptionPlan;
import com.careerops.model.SubscriptionStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class StripePlanMapper {

    private static final Logger log = LoggerFactory.getLogger(StripePlanMapper.class);

    private final StripeProperties properties;

    public StripePlanMapper(StripeProperties properties) {
        this.properties = properties;
    }

    public String priceIdForPlan(SubscriptionPlan plan) {
        return switch (plan) {
            case PRO -> properties.getPriceId().getPro();
            case ENTERPRISE -> properties.getPriceId().getEnterprise();
            case FREE -> throw new IllegalArgumentException("FREE plan has no Stripe price");
        };
    }

    public Optional<SubscriptionPlan> resolvePlanForPriceId(String priceId) {
        if (priceId == null || priceId.isBlank()) {
            return Optional.empty();
        }
        if (priceId.equals(properties.getPriceId().getEnterprise())) {
            return Optional.of(SubscriptionPlan.ENTERPRISE);
        }
        if (priceId.equals(properties.getPriceId().getPro())) {
            return Optional.of(SubscriptionPlan.PRO);
        }
        log.error("Unknown Stripe price id configured in webhook/subscription: {}", priceId);
        return Optional.empty();
    }

    public SubscriptionStatus mapStripeStatus(String stripeStatus) {
        if (stripeStatus == null) {
            return SubscriptionStatus.CANCELLED;
        }
        return switch (stripeStatus) {
            case "active" -> SubscriptionStatus.ACTIVE;
            case "trialing" -> SubscriptionStatus.ACTIVE;
            case "past_due", "incomplete", "paused" -> SubscriptionStatus.PAST_DUE;
            case "canceled", "unpaid", "incomplete_expired" -> SubscriptionStatus.CANCELLED;
            default -> {
                log.warn("Unknown Stripe subscription status: {}; treating as ACTIVE", stripeStatus);
                yield SubscriptionStatus.ACTIVE;
            }
        };
    }
}
