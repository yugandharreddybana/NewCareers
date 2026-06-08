package com.careerops.service;

import com.careerops.billing.StripeGateway;
import com.careerops.model.Subscription;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class BillingStripeSyncService {

    private static final Logger log = LoggerFactory.getLogger(BillingStripeSyncService.class);

    private final StripeGateway stripeGateway;

    public BillingStripeSyncService(StripeGateway stripeGateway) {
        this.stripeGateway = stripeGateway;
    }

    public void cancelAndDetachStripe(Subscription subscription) {
        String subscriptionId = subscription.getStripeSubscriptionId();
        if (subscriptionId != null && !subscriptionId.isBlank() && !isMockId(subscriptionId)) {
            try {
                stripeGateway.cancelSubscriptionImmediately(subscriptionId);
            } catch (Exception ex) {
                log.warn("Stripe subscription cancel failed subId={}: {}", subscriptionId, ex.getMessage());
            }
        }

        String customerId = subscription.getStripeCustomerId();
        if (customerId != null && !customerId.isBlank() && !isMockId(customerId)) {
            try {
                stripeGateway.deleteCustomer(customerId);
            } catch (Exception ex) {
                log.warn("Stripe customer delete failed customerId={}: {}", customerId, ex.getMessage());
            }
        }

        subscription.setStripeSubscriptionId(null);
        subscription.setStripeCustomerId(null);
    }

    private static boolean isMockId(String id) {
        return id.startsWith("cus_mock_") || id.startsWith("sub_mock_");
    }
}
