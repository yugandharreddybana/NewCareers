package com.careerops.service;

import com.careerops.model.Profile;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Task 140 — ProfileValidator completeness rules
 * Covers: no CV = 0%, full profile = 100%, each field adds correct %.
 */
class ProfileValidatorTest {

    private final ProfileValidator validator = new ProfileValidator();

    // ── 1. No CV → completeness 0% ────────────────────────────────────────
    @Test
    @DisplayName("no CV → completeness is 0")
    void noCV_completenessIsZero() {
        Profile p = new Profile();
        // No fields set — activeCvFileName is null
        int score = validator.calcCompleteness(p);
        assertThat(score).isEqualTo(0);
    }

    // ── 2. Full profile → completeness 100% ──────────────────────────────
    @Test
    @DisplayName("full profile → completeness is 100")
    void fullProfile_completenessIsOneHundred() {
        Profile p = fullProfile();
        int score = validator.calcCompleteness(p);
        assertThat(score).isEqualTo(100);
    }

    // ── 3. CV alone contributes correct weight ─────────────────────────────
    @Test
    @DisplayName("CV alone — contributes ≥30% to completeness")
    void cvAlone_contributesAtLeast30Percent() {
        Profile p = new Profile();
        p.setActiveCvFileName("my-cv.pdf");
        int score = validator.calcCompleteness(p);
        assertThat(score).isGreaterThanOrEqualTo(30);
    }

    // ── 4. Target roles contributes correct weight ────────────────────────
    @Test
    @DisplayName("target roles — adds percentage when present")
    void targetRoles_addsPercentage() {
        Profile withRoles    = new Profile();
        withRoles.setTargetRoles(List.of("Engineer"));
        Profile withoutRoles = new Profile();

        int with    = validator.calcCompleteness(withRoles);
        int without = validator.calcCompleteness(withoutRoles);
        assertThat(with).isGreaterThan(without);
    }

    // ── 5. Tech stack contributes correct weight ──────────────────────────
    @Test
    @DisplayName("tech stack — adds percentage when present")
    void techStack_addsPercentage() {
        Profile with    = new Profile();
        with.setTechStack(List.of("React"));
        Profile without = new Profile();

        assertThat(validator.calcCompleteness(with))
            .isGreaterThan(validator.calcCompleteness(without));
    }

    // ── helper ─────────────────────────────────────────────────────────────
    private Profile fullProfile() {
        Profile p = new Profile();
        p.setActiveCvFileName("cv.pdf");
        p.setTargetRoles(List.of("Senior Engineer"));
        p.setTechStack(List.of("React", "Java"));
        p.setLocation("Dublin");
        p.setGoalTitle("Engineering Manager");
        p.setGoalSalaryMin(80000);
        p.setGoalSalaryMax(120000);
        return p;
    }
}
