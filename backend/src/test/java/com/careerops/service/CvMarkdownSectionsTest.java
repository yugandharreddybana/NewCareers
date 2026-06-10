package com.careerops.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CvMarkdownSectionsTest {

    @Test
    void sectionMatchKeyNormalizesExperienceAliases() {
        assertThat(CvMarkdownSections.sectionMatchKey("Experience"))
            .isEqualTo(CvMarkdownSections.sectionMatchKey("Professional experience"));
        assertThat(CvMarkdownSections.sectionMatchKey("WORK EXPERIENCE"))
            .isEqualTo(CvMarkdownSections.sectionMatchKey("Professional experience"));
    }

    @Test
    void sectionMatchKeyNormalizesSummaryAliases() {
        assertThat(CvMarkdownSections.sectionMatchKey("Profile"))
            .isEqualTo(CvMarkdownSections.sectionMatchKey("Professional summary"));
        assertThat(CvMarkdownSections.sectionMatchKey("SUMMARY"))
            .isEqualTo(CvMarkdownSections.sectionMatchKey("Professional summary"));
    }
}
