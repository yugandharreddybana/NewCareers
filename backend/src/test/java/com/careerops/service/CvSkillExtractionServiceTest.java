package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CvSkillExtractionServiceTest {

    private CvSkillExtractionService extraction;
    private UserJobSkillMatchService matchService;

    @BeforeEach
    void setUp() {
        extraction = new CvSkillExtractionService();
        JobMatchingService jobMatcher =
            new JobMatchingService(Clock.fixed(Instant.parse("2026-05-29T12:00:00Z"), ZoneOffset.UTC));
        matchService = new UserJobSkillMatchService(extraction, null, null, null, null, jobMatcher);
    }

    @Test
    void extractFromSkillsSection_parsesCategorySkillLines() {
        String cv = """
            Skills

            Frontend: React.js, Redux, TypeScript, JavaScript (ES6+), HTML5, CSS3, Figma
            Backend: Java, Spring Boot, Node.js, REST API, Microservices Architecture
            Databases: PostgreSQL, SQL Server, MySQL
            Cloud & DevOps: Docker, Jenkins, GitHub Actions, CI/CD, Git, AWS
            """;

        List<String> skills = extraction.extractFromSkillsSection(cv);

        assertThat(skills).contains(
            "React", "TypeScript", "Node.js", "Java", "Spring Boot",
            "PostgreSQL", "Figma", "Docker", "AWS", "CI/CD", "Git");
    }

    @Test
    void matchJobDescriptionToCv_checksEachJdSkillAgainstFullCv() {
        String jd = """
            We need React, TypeScript, Node.js, Java, PostgreSQL, Docker, AWS, CI/CD.
            Python and Next.js experience is a plus.
            """;
        String cv = """
            ## Experience
            Built React dashboards and Node.js APIs at Acme; used Java and AWS in production.
            ## Skills
            Backend: Java
            """;

        CvSkillExtractionService.JdCvSkillMatch result = extraction.matchJobDescriptionToCv(jd, cv);

        assertThat(result.matchedInCv()).contains("Java", "React", "Node.js", "AWS");
        assertThat(result.missingFromCv()).contains("TypeScript", "Python", "Next.js", "PostgreSQL", "CI/CD");
        assertThat(result.missingFromCv()).doesNotContain("Java", "React", "Node.js", "AWS");
    }

    @Test
    void matchJobDescriptionToCv_findsReactInExperienceNotOnlySkillsSection() {
        String jd = "Required: React, TypeScript, and AWS. Java is a plus.";
        String cv = """
            ## Experience
            Delivered customer-facing UI with React.js and TypeScript for 2 years.
            ## Skills
            Databases: PostgreSQL
            """;

        CvSkillExtractionService.JdCvSkillMatch result = extraction.matchJobDescriptionToCv(jd, cv);

        assertThat(result.matchedInCv()).contains("React", "TypeScript");
        assertThat(result.missingFromCv()).contains("AWS", "Java");
    }

    @Test
    void computeJobMatch_jdFirst_eachPostingSkillCheckedAgainstFullCv() {
        UserProfile profile = new UserProfile();
        profile.setTechStack(new String[] { "Kotlin" });

        String cv = """
            ## Experience
            Built React dashboards and Node.js APIs at Acme; used Java and AWS in production.
            ## Skills
            Backend: Java
            """;

        Job job = new Job();
        job.setTitle("Full Stack Engineer");
        job.setDescription("""
            We need React, TypeScript, Node.js, Java, PostgreSQL, Docker, AWS, CI/CD.
            Python and Next.js experience is a plus. Figma knowledge helpful.
            """);

        UserJobSkillMatchService.SkillMatch match = matchService.compute(profile, cv, job);

        assertThat(match.matched()).contains("Java", "React", "Node.js", "AWS");
        assertThat(match.gaps()).contains("TypeScript", "Python", "Next.js", "PostgreSQL", "Figma", "CI/CD");
        assertThat(match.gaps()).doesNotContain("Java", "React", "Node.js", "AWS");
    }

    @Test
    void computeJobMatch_titleOnlyJavaRole_listsSkillsMissingFromCv() {
        UserProfile profile = new UserProfile();
        profile.setTechStack(new String[] { "Java", "Spring Boot" });

        Job job = new Job();
        job.setTitle("Software Engineer III - Java, Spring");
        job.setDescription("");

        UserJobSkillMatchService.SkillMatch match = matchService.compute(profile, "", job);

        assertThat(match.matched()).isEmpty();
        assertThat(match.gaps()).contains("Java", "Spring Boot");
    }

    @Test
    void computeJobMatch_springInCvExperience_countsAsMatched() {
        UserProfile profile = new UserProfile();

        Job job = new Job();
        job.setTitle("Software Engineer III - Java, Spring");
        job.setDescription("");

        String cv = """
            ## Experience
            Developed microservices with Java and Spring Boot for banking clients.
            """;

        UserJobSkillMatchService.SkillMatch match = matchService.compute(profile, cv, job);

        assertThat(match.matched()).contains("Java", "Spring Boot");
        assertThat(match.gaps()).isEmpty();
    }

    @Test
    void extractFromSkillsSection_ignoresContactHeaderAndExperience() {
        String cv = """
            # Jane Doe
            Email: jane.doe@outlook.com
            Phone: +353 87 123 4567

            ## Experience
            Built React dashboards at Acme using Python and Kubernetes.

            ## Skills
            Backend: Java, Spring Boot
            """;

        List<String> skills = extraction.extractFromSkillsSection(cv);

        assertThat(skills).contains("Java", "Spring Boot");
        assertThat(skills).doesNotContain("React", "Python", "Kubernetes");
    }
}
