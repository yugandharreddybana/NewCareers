package com.careerops.service;

import com.careerops.model.UserProfile;

/**
 * Resolves whether a user should access the main app vs the onboarding wizard.
 * {@code onboarded = null} on legacy rows is treated as complete when profile data exists.
 */
public final class OnboardingStatusResolver {

    private OnboardingStatusResolver() {}

    public static boolean isOnboarded(UserProfile profile) {
        if (profile == null) {
            return false;
        }
        if (Boolean.TRUE.equals(profile.getOnboarded())) {
            return true;
        }
        if (Boolean.FALSE.equals(profile.getOnboarded())) {
            return false;
        }
        return legacyProfileComplete(profile);
    }

    private static boolean legacyProfileComplete(UserProfile profile) {
        if (profile.getTargetRoles() != null && profile.getTargetRoles().length > 0) {
            return true;
        }
        String goal = profile.getGoalTitle();
        if (goal != null && !goal.isBlank()) {
            return true;
        }
        String location = profile.getLocation();
        return location != null && !location.isBlank()
            && profile.getMinMatchPercent() != null;
    }
}
