package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ApplyAssistServiceTest {

    @Test
    void inferRoleLabel_prefersBackendForJavaRole() {
        Job job = Job.builder()
            .title("Software Engineer II - Backend (Java)")
            .company("Bank")
            .description("Java, Spring Boot, microservices")
            .build();
        UserProfile profile = new UserProfile();
        profile.setTargetRoles(new String[]{"Frontend Architect"});

        assertThat(ApplyAssistService.inferRoleLabel(job, profile)).isEqualTo("Backend engineer");
    }

    @Test
    void inferRoleLabel_usesTargetRoleWhenAligned() {
        Job job = Job.builder()
            .title("Senior React Developer")
            .description("React, TypeScript, UI")
            .build();
        UserProfile profile = new UserProfile();
        profile.setTargetRoles(new String[]{"Frontend Engineer"});

        assertThat(ApplyAssistService.inferRoleLabel(job, profile)).containsIgnoringCase("front");
    }
}
