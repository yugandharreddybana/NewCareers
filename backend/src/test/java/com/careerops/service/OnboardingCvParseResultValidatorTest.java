package com.careerops.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OnboardingCvParseResultValidatorTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private OnboardingCvParseResultValidator validator;

    @BeforeEach
    void setUp() {
        validator = new OnboardingCvParseResultValidator();
    }

    @Test
    void validate_parsesWorkEducationProjectsAndTech() throws Exception {
        var root = mapper.readTree("""
            {
              "headline": "Full Stack Developer",
              "cvMarkdown": "## Summary\\nExperienced engineer.",
              "linkedInUrl": "https://linkedin.com/in/test",
              "techStack": ["React", "react.js", "Java"],
              "targetRoles": ["backend engineer", "Software Engineer", "backend engineer"],
              "workExperience": [{
                "jobTitle": "Engineer",
                "companyName": "Acme",
                "startDate": "2021-08",
                "endDate": "2024-01",
                "current": false,
                "description": "Built APIs",
                "location": "Dublin"
              }],
              "education": [{
                "schoolName": "Trinity",
                "degree": "BSc",
                "fieldOfStudy": "CS",
                "graduationYear": "2020"
              }],
              "projects": [{
                "title": "CareerOps",
                "description": "Job platform",
                "url": "https://example.com",
                "techTags": ["TypeScript"]
              }]
            }
            """);

        var result = validator.validate(root);

        assertThat(result.headline()).isEqualTo("Full Stack Developer");
        assertThat(result.workExperience()).hasSize(1);
        assertThat(result.education()).hasSize(1);
        assertThat(result.projects()).hasSize(1);
        assertThat(result.techStack()).contains("React", "Java");
        assertThat(result.targetRoles()).containsExactly("Backend Engineer", "Software Engineer");
        assertThat(result.linkedInUrl()).startsWith("https://");
    }

    @Test
    void validate_rejectsRawJsonExtractorFallback() throws Exception {
        var root = mapper.readTree("""
            {"raw": "Sorry, I cannot parse this."}
            """);
        assertThatThrownBy(() -> validator.validate(root))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("not valid JSON");
    }

    @Test
    void validate_rejectsEmptyAiPayload() throws Exception {
        var root = mapper.readTree("""
            {
              "headline": "",
              "cvMarkdown": "",
              "techStack": [],
              "workExperience": [],
              "education": [],
              "projects": []
            }
            """);
        assertThatThrownBy(() -> validator.validate(root))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("no usable CV fields");
    }

    @Test
    void hasExtractedContent_trueWhenWorkPresent() throws Exception {
        var root = mapper.readTree("""
            {
              "cvMarkdown": "## Summary\\nShort",
              "workExperience": [{
                "jobTitle": "Engineer",
                "companyName": "Acme",
                "startDate": "2020",
                "current": true,
                "description": "Built APIs"
              }]
            }
            """);
        assertThat(validator.hasExtractedContent(validator.validate(root))).isTrue();
    }

    @Test
    void validate_rejectsScriptInMarkdown() throws Exception {
        var root = mapper.readTree("""
            {"cvMarkdown": "## Summary\\n<script>alert(1)</script>"}
            """);
        assertThatThrownBy(() -> validator.validate(root))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void sanitizeSkillToken_rejectsUrlsAndEmails() {
        assertThat(OnboardingCvParseResultValidator.sanitizeSkillToken("https://evil.com")).isBlank();
        assertThat(OnboardingCvParseResultValidator.sanitizeSkillToken("user@mail.com")).isBlank();
        assertThat(OnboardingCvParseResultValidator.sanitizeSkillToken("TypeScript")).isEqualTo("TypeScript");
    }

    @Test
    void validate_targetRolesRejectsUrlsAndDedupes() throws Exception {
        var root = mapper.readTree("""
            {
              "cvMarkdown": "## Summary\\nEngineer with experience.",
              "targetRoles": [
                "https://evil.com",
                "Staff Nurse",
                "software engineer",
                "Software Engineer",
                "Backend Engineer"
              ],
              "workExperience": []
            }
            """);
        var result = validator.validate(root);
        assertThat(result.targetRoles()).containsExactly(
            "Staff Nurse", "Software Engineer", "Backend Engineer");
        assertThat(result.targetRoles()).noneMatch(r -> r.contains("http"));
    }

    @Test
    void parseProjects_extractsUrlFromDescriptionWhenFieldBlank() throws Exception {
        var root = mapper.readTree("""
            {
              "cvMarkdown": "## Summary\\nEngineer.",
              "projects": [{
                "title": "CareerOps",
                "description": "Job platform. github.com/user/careerops",
                "url": "",
                "techTags": []
              }]
            }
            """);
        var result = validator.validate(root);
        assertThat(result.projects()).hasSize(1);
        assertThat(result.projects().get(0).url()).isEqualTo("https://github.com/user/careerops");
        assertThat(result.projects().get(0).description()).doesNotContain("github.com");
    }

    @Test
    void parseProjects_normalizesBareGithubUrlField() throws Exception {
        var root = mapper.readTree("""
            {
              "cvMarkdown": "## Summary\\nEngineer.",
              "projects": [{
                "title": "CareerOps",
                "description": "Job platform",
                "url": "github.com/user/careerops",
                "techTags": []
              }]
            }
            """);
        var result = validator.validate(root);
        assertThat(result.projects().get(0).url()).isEqualTo("https://github.com/user/careerops");
    }

    @Test
    void sanitizeRoleToken_normalizesCatalogLabels() {
        assertThat(OnboardingCvParseResultValidator.sanitizeRoleToken("software engineer"))
            .isEqualTo("Software Engineer");
        assertThat(OnboardingCvParseResultValidator.sanitizeRoleToken("user@mail.com")).isBlank();
    }

    @Test
    void mergeTechStack_capsAtForty() {
        List<String> ai = IntStream.range(0, 30)
            .mapToObj(i -> "Skill" + i)
            .toList();
        List<String> dict = IntStream.range(25, 50)
            .mapToObj(i -> "Dict" + i)
            .toList();
        List<String> merged = validator.mergeTechStack(ai, dict);
        assertThat(merged).hasSizeLessThanOrEqualTo(OnboardingCvParseResultValidator.MAX_TECH);
    }
}
