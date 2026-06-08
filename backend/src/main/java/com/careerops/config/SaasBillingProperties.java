package com.careerops.config;

import com.careerops.model.SubscriptionPlan;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.math.BigDecimal;

@ConfigurationProperties(prefix = "saas.billing")
public class SaasBillingProperties {

    /** Default Pro trial length for new signups (days). */
    private int trialDays = 7;

    /**
     * When set, overrides profile-based enforcement disable in dev/test.
     * Defaults to true in application.properties for production safety.
     */
    private boolean enforcementEnabled = true;

    private final Price price = new Price();

    public int getTrialDays() {
        return trialDays;
    }

    public void setTrialDays(int trialDays) {
        this.trialDays = trialDays;
    }

    public boolean isEnforcementEnabled() {
        return enforcementEnabled;
    }

    public void setEnforcementEnabled(boolean enforcementEnabled) {
        this.enforcementEnabled = enforcementEnabled;
    }

    public Price getPrice() {
        return price;
    }

    public BigDecimal priceFor(SubscriptionPlan plan) {
        return switch (plan) {
            case FREE -> price.free;
            case PRO -> price.pro;
            case ENTERPRISE -> price.enterprise;
        };
    }

    public static class Price {
        private BigDecimal free = BigDecimal.ZERO;
        private BigDecimal pro = new BigDecimal("19");
        private BigDecimal enterprise = new BigDecimal("299");

        public BigDecimal getFree() {
            return free;
        }

        public void setFree(BigDecimal free) {
            this.free = free;
        }

        public BigDecimal getPro() {
            return pro;
        }

        public void setPro(BigDecimal pro) {
            this.pro = pro;
        }

        public BigDecimal getEnterprise() {
            return enterprise;
        }

        public void setEnterprise(BigDecimal enterprise) {
            this.enterprise = enterprise;
        }
    }
}
