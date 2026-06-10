package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.User;
import com.careerops.model.UserProfile;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class TailorResumeDeterministicSupportTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void ensureTailorableSections_expandsHeaderOnlyCvUsingProfile() {
        UserProfile profile = new UserProfile();
        profile.setGoalTitle("Registered nurse");
        profile.setExperienceLevel("senior");
        profile.setTechStack(new String[] { "Patient care", "Clinical documentation" });
        profile.setWorkExperience(List.of(
            UserProfile.WorkExperienceEntry.builder()
                .jobTitle("Staff Nurse")
                .companyName("City Hospital")
                .startDate("Jan 2019")
                .endDate("Present")
                .current(true)
                .description("• Managed ward rounds\n• Coordinated multidisciplinary care")
                .build()));
        profile.setEducation(List.of(
            UserProfile.EducationEntry.builder()
                .degree("BSc Nursing")
                .schoolName("Trinity College Dublin")
                .graduationYear("2018")
                .build()));

        String flatCv = """
            Jane Doe
            jane@example.com
            Staff nurse with hospital experience.
            """;

        List<CvMarkdownSections.Section> parsed = CvMarkdownSections.parse(flatCv);
        assertThat(parsed).hasSize(1);
        assertThat(parsed.get(0).name()).isEqualToIgnoringCase("Header");

        List<CvMarkdownSections.Section> resolved =
            TailorResumeDeterministicSupport.ensureTailorableSections(parsed, profile, flatCv);

        assertThat(resolved).extracting(CvMarkdownSections.Section::name)
            .anyMatch(n -> n.toLowerCase(Locale.ROOT).contains("summary"))
            .anyMatch(n -> n.toLowerCase(Locale.ROOT).contains("experience"))
            .anyMatch(n -> n.toLowerCase(Locale.ROOT).contains("skill"));
    }

    @Test
    void buildThreeSentenceSummary_avoidsStackLanguageForNonTechRole() {
        UserProfile profile = new UserProfile();
        profile.setGoalTitle("Registered nurse");
        profile.setExperienceLevel("senior");
        profile.setSectors(new String[] { "Healthcare" });

        Job job = new Job();
        job.setTitle("Clinical Nurse Manager");
        job.setCompany("St. James Hospital");
        job.setDescription("Lead ward teams, quality improvement, and patient safety.");

        String summary = TailorResumeDeterministicSupport.buildThreeSentenceSummary(
            profile, job, List.of("Patient safety", "Quality improvement"));

        assertThat(summary).doesNotContainIgnoringCase("stack");
        assertThat(summary).doesNotContainIgnoringCase("Targeting");
        assertThat(summary).contains("Patient safety");
        assertThat(summary).contains("St. James Hospital");
    }

    @Test
    void buildThreeSentenceSummary_usesMatchedSkillsForTechRole() {
        UserProfile profile = new UserProfile();
        profile.setExperienceLevel("senior");

        Job job = new Job();
        job.setTitle("Full Stack Developer (Python / React)");
        job.setCompany("RECRUITERS");
        job.setDescription("Python, React, PostgreSQL required.");

        String summary = TailorResumeDeterministicSupport.buildThreeSentenceSummary(
            profile, job, List.of("React", "Python"));

        assertThat(summary).contains("React");
        assertThat(summary).contains("Python");
        assertThat(summary).contains("RECRUITERS");
        assertThat(summary).doesNotContain("where this stack is central");
    }

    @Test
    void needsSectionRepair_detectsLegacyTemplateSummary() {
        com.fasterxml.jackson.databind.node.ObjectNode out = mapper.createObjectNode();
        out.put("summary",
            "Frontend engineer with hands-on experience across React, Python. "
                + "Targeting Full Stack Developer at RECRUITERS where this stack is central to the posting. "
                + "Ready to deliver measurable outcomes aligned to the team's priorities.");
        out.putArray("sections").addObject()
            .put("name", "Professional summary")
            .put("rewritten", out.path("summary").asText());

        assertThat(TailorResumeDeterministicSupport.needsSectionRepair(out)).isTrue();
        assertThat(TailorResumeDeterministicSupport.isLegacyTemplateSummary(out.path("summary").asText())).isTrue();
    }

    @Test
    void repairThinOutputInPlace_upgradesLegacyCachedRun() throws Exception {
        CvSkillExtractionService skillExtraction = Mockito.mock(CvSkillExtractionService.class);
        TailorResumeHtmlRenderer htmlRenderer = new TailorResumeHtmlRenderer();
        TailorResumeAiService tailorAi = Mockito.mock(TailorResumeAiService.class);
        when(skillExtraction.extractForUser(any(), any(), any())).thenReturn(List.of("React", "Python"));
        when(skillExtraction.matchedInJob(any(), any())).thenReturn(List.of("React", "Python"));
        when(skillExtraction.gapsInJob(any(), any())).thenReturn(List.of());

        TailorResumeBuilderService builder = new TailorResumeBuilderService(
            skillExtraction, htmlRenderer, tailorAi, Mockito.mock(com.careerops.repository.UserRepository.class), mapper);

        UserProfile profile = new UserProfile();
        profile.setExperienceLevel("senior");
        profile.setWorkExperience(List.of(
            UserProfile.WorkExperienceEntry.builder()
                .jobTitle("Developer")
                .companyName("Acme")
                .startDate("2020")
                .endDate("Present")
                .current(true)
                .description("• Built APIs with Python")
                .build()));

        Job job = new Job();
        job.setTitle("Full Stack Developer (Python / React)");
        job.setCompany("RECRUITERS");
        job.setDescription("React and Python.");

        ObjectNode stale = mapper.createObjectNode();
        stale.put("summary",
            "Frontend engineer with hands-on experience across React, Python. "
                + "Targeting Full Stack Developer at RECRUITERS where this stack is central to the posting. "
                + "Ready to deliver measurable outcomes aligned to the team's priorities.");
        stale.put("mode", "deterministic");
        stale.put("baselineMarkdown", "Developer at Acme\nBuilt React apps.");
        ArrayNode sections = stale.putArray("sections");
        sections.addObject()
            .put("name", "Professional summary")
            .put("original", "Old summary")
            .put("rewritten", stale.path("summary").asText());

        assertThat(builder.repairThinOutputInPlace(stale, profile, job, UUID.randomUUID())).isTrue();
        assertThat(stale.path("summary").asText()).doesNotContain("where this stack is central");
        assertThat(stale.path("sections").size()).isGreaterThanOrEqualTo(2);
    }

    @Test
    void deterministicBuild_rendersExperienceAndSkillsInHtml() throws Exception {
        CvSkillExtractionService skillExtraction = Mockito.mock(CvSkillExtractionService.class);
        TailorResumeHtmlRenderer htmlRenderer = new TailorResumeHtmlRenderer();
        TailorResumeAiService tailorAi = Mockito.mock(TailorResumeAiService.class);
        when(tailorAi.tryBuild(any(), any(), any(), any(), any())).thenReturn(Optional.empty());
        when(skillExtraction.extractForUser(any(), any(), any())).thenReturn(List.of("React", "Python"));
        when(skillExtraction.matchedInJob(any(), any())).thenReturn(List.of("React", "Python"));
        when(skillExtraction.gapsInJob(any(), any())).thenReturn(List.of());

        TailorResumeBuilderService builder = new TailorResumeBuilderService(
            skillExtraction, htmlRenderer, tailorAi, Mockito.mock(com.careerops.repository.UserRepository.class), mapper);

        UserProfile profile = new UserProfile();
        profile.setExperienceLevel("senior");
        profile.setTechStack(new String[] { "React", "Python" });
        profile.setWorkExperience(List.of(
            UserProfile.WorkExperienceEntry.builder()
                .jobTitle("Developer")
                .companyName("Acme")
                .startDate("2020")
                .endDate("Present")
                .current(true)
                .description("• Built APIs with Python")
                .build()));

        Job job = new Job();
        job.setTitle("Full Stack Developer (Python / React)");
        job.setCompany("RECRUITERS");
        job.setDescription("React and Python required.");

        String flatCv = "Yugandhar\nengineer@example.com\nBuilt apps with React and Python.";

        ObjectNode out = builder.build(UUID.randomUUID(), profile, job, flatCv, "test");
        String html = out.path("resumeHtml").asText("");

        assertThat(out.path("mode").asText()).isEqualTo("deterministic");
        assertThat(out.path("sections").size()).isGreaterThanOrEqualTo(3);
        assertThat(html).containsIgnoringCase("Professional Summary");
        assertThat(html).containsIgnoringCase("Experience");
        assertThat(html).contains("Acme");
        assertThat(html).contains("React");
    }
}
