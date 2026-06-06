package com.careerops.service;

import com.careerops.model.UserProfile;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OnboardingStatusResolverTest {

    @Test
    void explicitTrue() {
        UserProfile p = new UserProfile();
        p.setOnboarded(true);
        assertTrue(OnboardingStatusResolver.isOnboarded(p));
    }

    @Test
    void explicitFalse() {
        UserProfile p = new UserProfile();
        p.setOnboarded(false);
        p.setTargetRoles(new String[] { "Engineer" });
        assertFalse(OnboardingStatusResolver.isOnboarded(p));
    }

    @Test
    void nullOnboardedWithTargetRolesIsComplete() {
        UserProfile p = new UserProfile();
        p.setTargetRoles(new String[] { "Full Stack Developer" });
        assertTrue(OnboardingStatusResolver.isOnboarded(p));
    }

    @Test
    void nullOnboardedEmptyProfileIsIncomplete() {
        assertFalse(OnboardingStatusResolver.isOnboarded(new UserProfile()));
    }
}
