package com.careerops.service.sources.company;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CompanyCareerRegistryTest {

    @Test
    void detectAutoStrategy_greenhouseUrl() {
        assertThat(CompanyCareerRegistry.detectAutoStrategy("https://boards.greenhouse.io/intercom"))
            .isEqualTo(CompanyCareerRegistry.Strategy.GREENHOUSE);
    }

    @Test
    void detectAutoStrategy_eyUsesPlaywright() {
        assertThat(CompanyCareerRegistry.detectAutoStrategy("https://careers.ey.com/ey/search/"))
            .isEqualTo(CompanyCareerRegistry.Strategy.PLAYWRIGHT);
    }

    @Test
    void registry_includesEyAndIntercomOverrides() {
        CompanyCareerRegistry registry = new CompanyCareerRegistry();
        assertThat(registry.find("EY")).isPresent();
        assertThat(registry.find("EY").orElseThrow().strategy())
            .isEqualTo(CompanyCareerRegistry.Strategy.PLAYWRIGHT);
        assertThat(registry.find("Intercom")).isPresent();
        assertThat(registry.find("Intercom").orElseThrow().strategy())
            .isEqualTo(CompanyCareerRegistry.Strategy.GREENHOUSE);
        assertThat(registry.find("Intercom").orElseThrow().slug()).isEqualTo("intercom");
    }

    @Test
    void detectSlug_greenhouseBoard() {
        assertThat(CompanyCareerRegistry.detectSlug("https://boards.greenhouse.io/intercom/jobs"))
            .isEqualTo("intercom");
    }
}
