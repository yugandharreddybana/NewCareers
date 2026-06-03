package com.careerops.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CvMarkdownSectionsTest {

    @Test
    void parse_splitsAllCapsSectionTitles() {
        String cv = """
            Yugandhar Reddy Bana
            Full Stack Software Engineer
            banayugandhar8@outlook.com

            PROFESSIONAL SUMMARY
            Mid-Level engineer with 4+ years of experience.

            PROFESSIONAL EXPERIENCE
            Acme Corp — Developer
            """;

        List<CvMarkdownSections.Section> sections = CvMarkdownSections.parse(cv);

        assertThat(sections).extracting(CvMarkdownSections.Section::name)
            .noneMatch(n -> n.equalsIgnoreCase("CV"));
        assertThat(sections).anyMatch(s -> s.name().equalsIgnoreCase("Professional summary"));
        assertThat(sections).anyMatch(s -> s.name().toLowerCase().contains("experience"));
    }
}
