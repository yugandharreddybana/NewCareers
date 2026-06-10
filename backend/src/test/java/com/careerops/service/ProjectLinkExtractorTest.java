package com.careerops.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ProjectLinkExtractorTest {

    @Test
    void normalizeUrl_addsHttpsForBareGithub() {
        assertThat(ProjectLinkExtractor.normalizeUrl("github.com/user/repo"))
            .isEqualTo("https://github.com/user/repo");
    }

    @Test
    void extractPrimary_prefersRepoOverDemo() {
        String text = """
            Demo: https://careerops.vercel.app
            GitHub: github.com/user/careerops
            """;
        assertThat(ProjectLinkExtractor.extractPrimary(text))
            .isEqualTo("https://github.com/user/careerops");
    }

    @Test
    void extractAndStrip_removesUrlFromDescription() {
        var resolved = ProjectLinkExtractor.extractAndStrip("""
            CareerOps Platform | Link
            github.com/user/careerops
            Built a job matching platform.
            """);
        assertThat(resolved.url()).isEqualTo("https://github.com/user/careerops");
        assertThat(resolved.cleanedText()).doesNotContain("github.com");
        assertThat(resolved.cleanedText()).containsIgnoringCase("job matching");
    }

    @Test
    void normalizeUrl_rejectsPlaceholders() {
        assertThat(ProjectLinkExtractor.normalizeUrl("Link")).isBlank();
    }
}
