package com.careerops.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class SecretRequirementsTest {

    @Autowired(required = false)
    SecretRequirements secretRequirements;

    @Test
    @DisplayName("SecretRequirements is not active on test profile")
    void skippedOnTestProfile() {
        assertThat(secretRequirements).isNull();
    }
}
