package com.careerops.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards onboarding pre-auth routes — missing entries cause
 * "Malformed or missing userId in InternalTrustFilter" on signup.
 */
class InternalTrustFilterPublicPathTest {

    private final PublicPathPolicy policy = new PublicPathPolicy(new org.springframework.mock.env.MockEnvironment());

    @Test
    void onboardingPreAuthRoutesArePublic() {
        assertThat(policy.isPublic("/auth/onboarding/check-email")).isTrue();
        assertThat(policy.isPublic("/auth/onboarding/check-password")).isTrue();
        assertThat(policy.isPublic("/auth/onboarding/send-verification-otp")).isTrue();
        assertThat(policy.isPublic("/auth/onboarding/resend-verification-otp")).isTrue();
        assertThat(policy.isPublic("/auth/onboarding/verify-email")).isTrue();
        assertThat(policy.isPublic("/v1/auth/onboarding/check-password")).isTrue();
    }
}
