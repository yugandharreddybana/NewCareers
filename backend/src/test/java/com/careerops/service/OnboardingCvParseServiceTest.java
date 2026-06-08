package com.careerops.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OnboardingCvParseServiceTest {

    @Test
    void parseWorkPath_extractsThreeRolesWithCurrentFlag() {
        var work = parseWorkFromFixture();
        assertThat(work).hasSize(3);
        assertThat(work.get(0).current()).isTrue();
        assertThat(work.get(0).startDate()).isEqualTo("2024-09");
        assertThat(work.get(2).startDate()).isEqualTo("2021-08");
        assertThat(work.get(2).endDate()).isEqualTo("2024-01");
    }

    @Test
    void sectionPipeline_findsEducationAndProjects() {
        String cv = """
            PROFESSIONAL EXPERIENCE
            Engineer Jan 2020 – Present
            Acme Corp
            ▪ Built APIs.

            EDUCATION
            BSc Computer Science, Trinity College Dublin, 2020

            PROJECTS
            CareerOps
            ▪ Job matching platform.
            """;
        var sections = CvMarkdownSections.parse(cv);
        String exp = sections.stream()
            .filter(s -> "Professional experience".equalsIgnoreCase(s.name()))
            .map(CvMarkdownSections.Section::body)
            .findFirst().orElse("");
        String edu = sections.stream()
            .filter(s -> "Education".equalsIgnoreCase(s.name()))
            .map(CvMarkdownSections.Section::body)
            .findFirst().orElse("");
        String projects = sections.stream()
            .filter(s -> "Projects".equalsIgnoreCase(s.name()))
            .map(CvMarkdownSections.Section::body)
            .findFirst().orElse("");

        assertThat(ExperienceSectionParser.splitIntoRoleBlocks(exp)).hasSize(1);
        assertThat(EducationSectionParser.parseEntries(edu)).hasSize(1);
        assertThat(ProjectsSectionParser.parseEntries(projects)).hasSize(1);
    }

    private static java.util.List<com.careerops.dto.AuthDtos.OnboardingCvParseWorkEntry> parseWorkFromFixture() {
        String experienceBody = """
            Full Stack Software Developer Sept 2024 – Present
            Independent Developer | Dublin, Ireland
            ▪ Building and shipping three production-grade full-stack applications.
            Full Stack Software Developer Apr 2024 – Sept 2024
            Freelance Developer | Dublin, Ireland
            ▪ Delivered short-cycle React, Node.js, and Java contract work.
            Software Engineer Aug 2021 – Jan 2024
            Incedo Technologies Solution Ltd (Client: Verizon) | Hyderabad, India
            ▪ Optimised Verizon's telecom search page by 67%.
            """;
        return invokeParseWork(experienceBody);
    }

    private static java.util.List<com.careerops.dto.AuthDtos.OnboardingCvParseWorkEntry> invokeParseWork(String body) {
        java.util.List<com.careerops.dto.AuthDtos.OnboardingCvParseWorkEntry> out = new java.util.ArrayList<>();
        for (String block : ExperienceSectionParser.splitIntoRoleBlocks(body)) {
            ExperienceSectionParser.ParsedRole role = ExperienceSectionParser.parseRoleBlock(block);
            CvDateRangeParser.ParsedDateRange dates = CvDateRangeParser.parse(role.dates());
            out.add(new com.careerops.dto.AuthDtos.OnboardingCvParseWorkEntry(
                role.title(),
                role.company(),
                dates.startDate(),
                dates.current() ? "" : dates.endDate(),
                dates.current(),
                String.join("\n", role.bullets()).trim(),
                role.location()
            ));
        }
        return out;
    }
}
