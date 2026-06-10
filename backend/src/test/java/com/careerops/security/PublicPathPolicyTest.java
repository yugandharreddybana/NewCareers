package com.careerops.security;



import org.junit.jupiter.api.Test;

import org.springframework.mock.env.MockEnvironment;



import static org.assertj.core.api.Assertions.assertThat;



class PublicPathPolicyTest {



    private PublicPathPolicy devPolicy() {

        return new PublicPathPolicy(new MockEnvironment());

    }



    private PublicPathPolicy prodPolicy() {

        MockEnvironment env = new MockEnvironment();

        env.setActiveProfiles("prod");

        return new PublicPathPolicy(env);

    }



    @Test

    void actuatorEndpointsAreNotPublic() {

        PublicPathPolicy policy = devPolicy();

        assertThat(policy.isPublic("/health")).isTrue();

        assertThat(policy.isPublic("/.well-known/jwks.json")).isTrue();

        assertThat(policy.isPublic("/actuator/health")).isFalse();

        assertThat(policy.securityPatterns()).doesNotContain("/actuator/**");

    }



    @Test

    void onboardingParseCvIsPublic() {

        assertThat(devPolicy().isPublic("/auth/onboarding/parse-cv")).isTrue();

    }



    @Test

    void signupIntentIsPublic() {

        PublicPathPolicy policy = devPolicy();

        assertThat(policy.isPublic("/auth/signup-intent")).isTrue();

        assertThat(policy.isPublic("/v1/auth/signup-intent")).isTrue();

        assertThat(policy.isPublic("/auth/signup-intent/00000000-0000-0000-0000-000000000001/exists")).isFalse();

    }



    @Test

    void authStepUpCallbacksArePublic() {

        PublicPathPolicy policy = devPolicy();

        assertThat(policy.isPublic("/auth/two-factor/verify")).isTrue();

        assertThat(policy.isPublic("/auth/google/link/confirm")).isTrue();

        assertThat(policy.isPublic("/v1/auth/two-factor/verify")).isTrue();

        assertThat(policy.isPublic("/v1/auth/google/link/confirm")).isTrue();

        assertThat(policy.securityPatterns()).contains(

                "/auth/two-factor/verify",

                "/auth/google/link/confirm");

    }



    @Test

    void billingPlansArePublic() {

        PublicPathPolicy policy = devPolicy();

        assertThat(policy.isPublic("/billing/plans")).isTrue();

        assertThat(policy.isPublic("/v1/billing/plans")).isTrue();

        assertThat(policy.securityPatterns()).contains("/billing/plans");

    }



    @Test

    void swaggerDisabledInProd() {

        PublicPathPolicy policy = prodPolicy();

        assertThat(policy.isPublic("/swagger-ui.html")).isFalse();

        assertThat(policy.isPublic("/v3/api-docs")).isFalse();

        assertThat(policy.securityPatterns()).doesNotContain("/swagger-ui/**");

    }



    @Test

    void onboardingCheckEmailIsPublic() {

        assertThat(devPolicy().isPublic("/auth/onboarding/check-email")).isTrue();

    }



    @Test

    void onboardingCheckPasswordIsPublic() {

        assertThat(devPolicy().isPublic("/auth/onboarding/check-password")).isTrue();

    }



    @Test

    void billingWebhookIsPublic() {

        assertThat(devPolicy().isPublic("/billing/webhook")).isTrue();

    }



    @Test

    void v1PrefixedOnboardingCheckPasswordIsPublic() {

        assertThat(devPolicy().isPublic("/v1/auth/onboarding/check-password")).isTrue();

        assertThat(devPolicy().isPublic("/v1/auth/onboarding/check-email")).isTrue();

    }



    @Test

    void v1PrefixedBillingWebhookIsPublic() {

        assertThat(devPolicy().isPublic("/v1/billing/webhook")).isTrue();

    }



    @Test

    void billingMutationsAreNotPublic() {

        PublicPathPolicy policy = devPolicy();

        assertThat(policy.isPublic("/billing/checkout-session")).isFalse();

        assertThat(policy.isPublic("/billing/cancel")).isFalse();

        assertThat(policy.isPublic("/billing/customer-portal")).isFalse();

        assertThat(policy.isPublic("/billing/subscription")).isFalse();

    }

}

