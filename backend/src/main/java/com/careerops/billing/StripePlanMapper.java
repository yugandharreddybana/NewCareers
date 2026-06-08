package com.careerops.billing;

import com.careerops.model.SubscriptionPlan;
import com.careerops.model.SubscriptionStatus;
import org.springframework.stereotype.Component;

@Component
public class StripePlanMapper {

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

    public SubscriptionPlan planForPriceId(String priceId) {
        if (priceId == null || priceId.isBlank()) {
            return SubscriptionPlan.FREE;
        }
        if (priceId.equals(properties.getPriceId().getEnterprise())) {
            return SubscriptionPlan.ENTERPRISE;
        }
        if (priceId.equals(properties.getPriceId().getPro())) {
            return SubscriptionPlan.PRO;
        }
        return SubscriptionPlan.FREE;
    }

    public SubscriptionStatus mapStripeStatus(String stripeStatus) {
        if (stripeStatus == null) {
            return SubscriptionStatus.CANCELLED;
        }
        return switch (stripeStatus) {
            case "active" -> SubscriptionStatus.ACTIVE;
            case "trialing" -> SubscriptionStatus.TRIALING;
            case "past_due" -> SubscriptionStatus.PAST_DUE;
            case "canceled", "unpaid", "incomplete_expired" -> SubscriptionStatus.CANCELLED;
            default -> SubscriptionStatus.CANCELLED;
        };
    }
}
