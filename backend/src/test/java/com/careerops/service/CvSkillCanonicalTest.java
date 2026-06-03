package com.careerops.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CvSkillCanonicalTest {

    @Test
    void reactAliasesCanonicalizeToSameName() {
        assertThat(CvSkillCanonical.canonicalize("React")).isEqualTo("React");
        assertThat(CvSkillCanonical.canonicalize("React.js")).isEqualTo("React");
        assertThat(CvSkillCanonical.canonicalize("reactjs")).isEqualTo("React");
    }

    @Test
    void dedupeCanonicalMergesAliases() {
        List<String> deduped = CvSkillCanonical.dedupeCanonical(
            List.of("React", "React.js", "TypeScript", "TS"));
        assertThat(deduped).containsExactly("React", "TypeScript");
    }

    @Test
    void jobHaystackContainsMatchesVariants() {
        String hay = "we need react.js and node experience";
        assertThat(CvSkillCanonical.jobHaystackContains(hay, "React")).isTrue();
        assertThat(CvSkillCanonical.jobHaystackContains(hay, "Node.js")).isTrue();
    }
}
