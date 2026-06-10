package com.careerops.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class HumanSummarySanitizerTest {

    @Test
    void sanitize_stripsEncryptedHeadlinePrefix() {
        String raw = "Headline: F+ltIU+rCn9abcdefghijklmnopqrstuvwxyz0123456789+/=. "
                + "Your background aligns with 3 core signals for Engineer at Acme (72%).";
        String sanitized = HumanSummarySanitizer.sanitize(raw);
        assertThat(sanitized).doesNotContain("Headline:");
        assertThat(sanitized).contains("Your background aligns");
    }

    @Test
    void sanitize_preservesCleanSummary() {
        String raw = "Your background aligns with 2 core signals for Developer at Co (68%).";
        assertThat(HumanSummarySanitizer.sanitize(raw)).isEqualTo(raw);
    }

    @Test
    void containsEncryptedHeadline_detectsCiphertext() {
        assertThat(HumanSummarySanitizer.containsEncryptedHeadline(
                "Headline: F+ltIU+rCn9abcdefghijklmnopqrstuvwxyz0123456789+/=.")).isTrue();
        assertThat(HumanSummarySanitizer.containsEncryptedHeadline(
                "Headline: Senior Engineer.")).isFalse();
    }
}
