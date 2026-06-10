package com.careerops.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OnboardingRoleCatalogTest {

    @Test
    void normalize_matchesCatalogCaseInsensitively() {
        assertThat(OnboardingRoleCatalog.normalize("full stack developer"))
            .isEqualTo("Full Stack Developer");
        assertThat(OnboardingRoleCatalog.normalize("Data Engineer"))
            .isEqualTo("Data Engineer");
    }

    @Test
    void normalize_keepsCustomTitles() {
        assertThat(OnboardingRoleCatalog.normalize("Staff Nurse"))
            .isEqualTo("Staff Nurse");
    }

    @Test
    void promptCatalogHint_listsAllSuggestedRoles() {
        assertThat(OnboardingRoleCatalog.promptCatalogHint())
            .contains("Software Engineer", "Backend Engineer");
    }
}
