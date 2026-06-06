package com.careerops.service;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SkillRunCachePolicyTest {

    @Test
    void computeExpiry_tailorResume_is48Hours() {
        Instant before = Instant.now();
        Instant expiry = SkillRunCachePolicy.computeExpiry("tailor-resume");
        Instant after = Instant.now();

        assertThat(expiry).isNotNull();
        assertThat(expiry).isAfterOrEqualTo(before.plus(48, ChronoUnit.HOURS).minusSeconds(2));
        assertThat(expiry).isBeforeOrEqualTo(after.plus(48, ChronoUnit.HOURS).plusSeconds(2));
    }

    @Test
    void computeExpiry_evaluate_is24Hours() {
        Instant before = Instant.now();
        Instant expiry = SkillRunCachePolicy.computeExpiry("evaluate");
        Instant after = Instant.now();

        assertThat(expiry).isNotNull();
        assertThat(expiry).isAfterOrEqualTo(before.plus(24, ChronoUnit.HOURS).minusSeconds(2));
        assertThat(expiry).isBeforeOrEqualTo(after.plus(24, ChronoUnit.HOURS).plusSeconds(2));
    }

    @Test
    void computeExpiry_compare_isNull() {
        assertThat(SkillRunCachePolicy.computeExpiry("compare")).isNull();
    }

    @Test
    void isCacheable_jobScopedSkills_returnsTrue() {
        for (String skill : List.of(
                "evaluate", "research", "prep-interview", "apply", "outreach", "tailor-resume")) {
            assertThat(SkillRunCachePolicy.isCacheable(skill)).isTrue();
        }
    }

    @Test
    void isCacheable_nonCacheableSkills_returnsFalse() {
        for (String skill : List.of(
                "compare", "help", "cover-letter", "salary-negotiation", "culture-fit", "linkedin-optimize")) {
            assertThat(SkillRunCachePolicy.isCacheable(skill)).isFalse();
        }
        assertThat(SkillRunCachePolicy.isCacheable(null)).isFalse();
        assertThat(SkillRunCachePolicy.isCacheable("")).isFalse();
        assertThat(SkillRunCachePolicy.isCacheable("   ")).isFalse();
    }

    @Test
    void computeExpiry_phase2Skill_isNull() {
        assertThat(SkillRunCachePolicy.computeExpiry("cover-letter")).isNull();
    }
}
