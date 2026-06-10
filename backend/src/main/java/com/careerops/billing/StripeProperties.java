package com.careerops.billing;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "stripe")
public class StripeProperties {

    private String secretKey = "";
    private String webhookSecret = "";
    private PriceIds priceId = new PriceIds();
    private CheckoutUrls checkout = new CheckoutUrls();
    private String portalReturnUrl = "";
    private String frontendBaseUrl = "";
    /** When true, mock checkout sessions auto-activate paid plans (local dev only). */
    private boolean mockCheckoutAutoActivate = false;

    public String getSecretKey() {
        return secretKey;
    }

    public void setSecretKey(String secretKey) {
        this.secretKey = secretKey;
    }

    public String getWebhookSecret() {
        return webhookSecret;
    }

    public void setWebhookSecret(String webhookSecret) {
        this.webhookSecret = webhookSecret;
    }

    public PriceIds getPriceId() {
        return priceId;
    }

    public void setPriceId(PriceIds priceId) {
        this.priceId = priceId;
    }

    public CheckoutUrls getCheckout() {
        return checkout;
    }

    public void setCheckout(CheckoutUrls checkout) {
        this.checkout = checkout;
    }

    public String getPortalReturnUrl() {
        return portalReturnUrl;
    }

    public void setPortalReturnUrl(String portalReturnUrl) {
        this.portalReturnUrl = portalReturnUrl;
    }

    public String getFrontendBaseUrl() {
        return frontendBaseUrl;
    }

    public void setFrontendBaseUrl(String frontendBaseUrl) {
        this.frontendBaseUrl = frontendBaseUrl;
    }

    public boolean isMockCheckoutAutoActivate() {
        return mockCheckoutAutoActivate;
    }

    public void setMockCheckoutAutoActivate(boolean mockCheckoutAutoActivate) {
        this.mockCheckoutAutoActivate = mockCheckoutAutoActivate;
    }

    public static class PriceIds {
        private String pro = "";
        private String enterprise = "";

        public String getPro() {
            return pro;
        }

        public void setPro(String pro) {
            this.pro = pro;
        }

        public String getEnterprise() {
            return enterprise;
        }

        public void setEnterprise(String enterprise) {
            this.enterprise = enterprise;
        }
    }

    public static class CheckoutUrls {
        private String successUrl = "";
        private String cancelUrl = "";

        public String getSuccessUrl() {
            return successUrl;
        }

        public void setSuccessUrl(String successUrl) {
            this.successUrl = successUrl;
        }

        public String getCancelUrl() {
            return cancelUrl;
        }

        public void setCancelUrl(String cancelUrl) {
            this.cancelUrl = cancelUrl;
        }
    }
}
