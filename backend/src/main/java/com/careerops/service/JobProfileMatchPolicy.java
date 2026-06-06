package com.careerops.service;

import com.careerops.model.UserProfile;

/**
 * Shared rules for minimum match % from the user's profile (onboarding / settings).
 */
public final class JobProfileMatchPolicy {

    private JobProfileMatchPolicy() {}

    public static int minMatchFloor(UserProfile profile) {
        if (profile == null) {
            return UserProfile.DEFAULT_MIN_MATCH_PERCENT;
        }
        Integer min = profile.getMinMatchPercent();
        return min != null && min > 0 ? min : UserProfile.DEFAULT_MIN_MATCH_PERCENT;
    }

    public static boolean meetsMinMatch(Integer matchPercent, UserProfile profile) {
        if (matchPercent == null) {
            return false;
        }
        return matchPercent >= minMatchFloor(profile);
    }
}
