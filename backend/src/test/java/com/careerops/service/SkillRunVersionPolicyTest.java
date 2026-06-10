package com.careerops.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SkillRunVersionPolicyTest {

    @Test
    void coverLetter_isVersioned_withLimitThree() {
        assertThat(SkillRunVersionPolicy.isVersioned("cover-letter")).isTrue();
        assertThat(SkillRunVersionPolicy.historyLimit("cover-letter")).isEqualTo(3);
    }

    @Test
    void evaluate_usesDefaultHistoryLimit() {
        assertThat(SkillRunVersionPolicy.isVersioned("evaluate")).isFalse();
        assertThat(SkillRunVersionPolicy.historyLimit("evaluate")).isEqualTo(12);
    }
}
