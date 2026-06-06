package com.careerops.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PublicPathPolicyTest {

    private final PublicPathPolicy policy = new PublicPathPolicy();

    @Test
    void actuatorEndpointsAreNotPublic() {
        assertThat(policy.isPublic("/health")).isTrue();
        assertThat(policy.isPublic("/.well-known/jwks.json")).isTrue();
        assertThat(policy.isPublic("/actuator/health")).isFalse();
        assertThat(policy.securityPatterns()).doesNotContain("/actuator/**");
    }

    @Test
    void onboardingParseCvIsPublic() {
        assertThat(policy.isPublic("/auth/onboarding/parse-cv")).isTrue();
    }

    @Test
    void onboardingCheckEmailIsPublic() {
        assertThat(policy.isPublic("/auth/onboarding/check-email")).isTrue();
    }
}