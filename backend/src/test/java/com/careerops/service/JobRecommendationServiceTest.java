package com.careerops.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JobRecommendationServiceTest {

    @Test
    void matchedSkillsToDelimitedString_handlesStringArrayFromNativeQuery() {
        assertThat(JobRecommendationService.matchedSkillsToDelimitedString(new String[] { "Java", "Spring Boot" }))
            .isEqualTo("Java, Spring Boot");
    }

    @Test
    void matchedSkillsToDelimitedString_handlesPlainString() {
        assertThat(JobRecommendationService.matchedSkillsToDelimitedString("[Java, React]"))
            .isEqualTo("Java, React");
    }
}
