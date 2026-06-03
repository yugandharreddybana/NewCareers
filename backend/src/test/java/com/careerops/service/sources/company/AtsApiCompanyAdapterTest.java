package com.careerops.service.sources.company;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AtsApiCompanyAdapterTest {

    @Test
    void matchesIreland_acceptsDublinAndRemote() {
        assertThat(AtsApiCompanyAdapter.matchesIreland("Dublin, Ireland")).isTrue();
        assertThat(AtsApiCompanyAdapter.matchesIreland("Remote - EMEA")).isTrue();
        assertThat(AtsApiCompanyAdapter.matchesIreland("San Francisco, CA")).isFalse();
    }

    @Test
    void matchesIreland_blankLocationDefaultsTrue() {
        assertThat(AtsApiCompanyAdapter.matchesIreland("")).isTrue();
        assertThat(AtsApiCompanyAdapter.matchesIreland(null)).isTrue();
    }
}
