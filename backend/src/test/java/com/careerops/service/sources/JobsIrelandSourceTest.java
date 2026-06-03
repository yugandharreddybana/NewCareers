package com.careerops.service.sources;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JobsIrelandSourceTest {

    @Test
    void matchesRole_rejectsUnrelatedTitleForFullStackDeveloper() {
        assertThat(JobsIrelandSource.matchesRole("Motor Mechanics", "Full Stack Developer")).isFalse();
    }

    @Test
    void matchesRole_acceptsRelevantTitle() {
        assertThat(JobsIrelandSource.matchesRole("Full Stack Developer", "Full Stack Developer")).isTrue();
        assertThat(JobsIrelandSource.matchesRole("Senior Software Engineer", "Software Engineer")).isTrue();
    }

    @Test
    void matchesRole_singleWordRoleRequiresTokenHit() {
        assertThat(JobsIrelandSource.matchesRole("Motor Mechanics", "Developer")).isFalse();
        assertThat(JobsIrelandSource.matchesRole("Java Developer", "Developer")).isTrue();
    }
}
