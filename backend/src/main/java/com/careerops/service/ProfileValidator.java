package com.careerops.service;

import com.careerops.model.UserProfile;
import com.careerops.repository.UserProfileRepository;
import com.careerops.repository.UserJobRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Validates that a user's profile has sufficient data to run a given skill.
 *
 * Returns a human-readable list of missing fields.
 * An empty list = profile is complete enough to run the skill.
 *
 * Called by SkillService BEFORE invoking Claude —
 * prevents Claude from failing mid-run due to missing data.
 */
@Service
public class ProfileValidator {

    // Skills that require at least one target role
    private static final Set<String> NEEDS_TARGET_ROLES = Set.of(
            "evaluate", "tailor-resume", "apply", "prep-interview", "scan"
    );

    // Skills that require an uploaded resume
    private static final Set<String> NEEDS_RESUME = Set.of(
            "evaluate", "tailor-resume", "apply", "outreach",
            "research", "prep-interview", "compare", "triage", "scan"
    );

    private final UserProfileRepository profiles;
    private final UserJobRepository      userJobs;
    private final CvService              cvService;

    public ProfileValidator(UserProfileRepository profiles,
                            UserJobRepository userJobs,
                            CvService cvService) {
        this.profiles = profiles;
        this.userJobs  = userJobs;
        this.cvService = cvService;
    }

    /**
     * Validate a user's profile for a specific skill.
     *
     * @param userId    Authenticated user ID
     * @param skillName The skill about to be run
     * @return List of human-readable missing field descriptions.
     *         Empty list = profile is sufficient.
     */
    public List<String> validateForSkill(UUID userId, String skillName) {
        List<String> missing = new ArrayList<>();

        // ── Resume check (all skills) ─────────────────────────────────
        if (NEEDS_RESUME.contains(skillName)) {
            try {
                String cv = cvService.activeCvText(userId);
                if (cv == null || cv.isBlank()) {
                    missing.add("Upload your CV/Resume in Settings → Resume");
                }
            } catch (Exception e) {
                missing.add("Upload your CV/Resume in Settings → Resume");
            }
        }

        // ── Profile completeness checks ──────────────────────────────
        UserProfile profile = profiles.findByUserId(userId).orElse(null);

        if (NEEDS_TARGET_ROLES.contains(skillName)) {
            if (profile == null ||
                profile.getTargetRoles() == null ||
                profile.getTargetRoles().length == 0) {
                missing.add("Add at least one Target Role in Settings → Career Preferences");
            }
        }

        if ("outreach".equals(skillName)) {
            if (profile == null || profile.getLocation() == null || profile.getLocation().isBlank()) {
                missing.add("Add your Location in Settings → Profile");
            }
        }

        // ── compare: need at least 2 saved jobs ────────────────────────
        if ("compare".equals(skillName)) {
            long jobCount = userJobs.countByUserId(userId);
            if (jobCount < 2) {
                missing.add("Save at least 2 jobs to your tracker before using Compare");
            }
        }

        // ── triage: need at least 1 saved job ────────────────────────
        if ("triage".equals(skillName)) {
            long jobCount = userJobs.countByUserId(userId);
            if (jobCount < 1) {
                missing.add("Save at least 1 job to your tracker before using Triage");
            }
        }

        return missing;
    }

    public static final int WEIGHT_CV = 30;
    public static final int WEIGHT_TARGET_ROLES = 20;
    public static final int WEIGHT_TECH_STACK = 20;
    public static final int WEIGHT_LOCATION = 10;
    public static final int WEIGHT_PORTFOLIO = 10;
    public static final int WEIGHT_CAREER_GOAL = 10;

    /**
     * Computes the completeness score for a user profile based on defined weights.
     */
    public static int computeScore(UserProfile profile, String cvName) {
        int score = 0;

        if (cvName != null && !cvName.isBlank()) score += WEIGHT_CV;

        if (profile.getTargetRoles() != null && profile.getTargetRoles().length > 0) score += WEIGHT_TARGET_ROLES;

        if (profile.getTechStack() != null && profile.getTechStack().length > 0) score += WEIGHT_TECH_STACK;

        if (profile.getLocation() != null && !profile.getLocation().isBlank()) score += WEIGHT_LOCATION;

        if (profile.getPortfolioItems() != null && !profile.getPortfolioItems().isEmpty()) score += WEIGHT_PORTFOLIO;

        boolean hasGoalTitle  = profile.getGoalTitle()     != null && !profile.getGoalTitle().isBlank();
        boolean hasGoalSalary = profile.getSalaryMin() != null && profile.getSalaryMax() != null
                             && profile.getSalaryMin() > 0     && profile.getSalaryMax() > 0;
        if (hasGoalTitle && hasGoalSalary) score += WEIGHT_CAREER_GOAL;

        return Math.min(score, 100);
    }
}
