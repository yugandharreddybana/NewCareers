package com.careerops.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JobDescriptionNormalizerTest {

    @Test
    void normalize_splitsSingleLineRecruitersStylePosting() {
        String singleLine = "We are hiring a Senior Software Engineer for a fintech client. "
                + "Salary: €60,000 to €85,000 DOE Hybrid: 3 days in office, 2 remote "
                + "Tech stack: Java, Spring Boot, React Requirements: 5+ years experience "
                + "Must have: Kubernetes, AWS";

        String normalized = JobDescriptionNormalizer.normalize(singleLine);

        assertThat(normalized).contains("Salary:");
        assertThat(normalized).contains("\n\nHybrid:");
        assertThat(normalized).contains("\n\nTech stack:");
        assertThat(normalized).contains("\n\nRequirements:");
        assertThat(normalized).contains("\n\nMust have:");
    }

    @Test
    void normalize_leavesShortTextUnchanged() {
        String shortText = "Short job blurb.";
        assertThat(JobDescriptionNormalizer.normalize(shortText)).isEqualTo(shortText);
    }
}
