package com.careerops.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class QuotaGrantPropertiesBindingTest {

    @Autowired
    QuotaGrantProperties properties;

    @Test
    void loadsQuotaGrantsFromConfiguration() {
        assertThat(properties.getQuotaGrants())
                .as("careerops.quota-grants must bind from application.yml/properties")
                .isNotEmpty();
        assertThat(properties.getQuotaGrants().get(0).getEmail())
                .isEqualToIgnoringCase("yugandharreddybana@outlook.com");
        assertThat(properties.getQuotaGrants().get(0).getTokenBudget()).isEqualTo(500_000L);
        assertThat(properties.getQuotaGrants().get(0).getJobsPerDay()).isEqualTo(25);
        assertThat(properties.getQuotaGrants().get(0).isUnlimitedSkills()).isTrue();
    }
}
