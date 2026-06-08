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

        assertThat(devPolicy().isPublic("/auth/signup-intent")).isTrue();

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

}

