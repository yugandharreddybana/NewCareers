package com.careerops.service;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

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
}
