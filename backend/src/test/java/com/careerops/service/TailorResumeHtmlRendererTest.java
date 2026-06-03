package com.careerops.service;



import com.careerops.model.Job;

import com.careerops.model.User;

import com.careerops.model.UserProfile;

import com.fasterxml.jackson.databind.ObjectMapper;

import com.fasterxml.jackson.databind.node.ArrayNode;

import com.fasterxml.jackson.databind.node.ObjectNode;

import org.junit.jupiter.api.BeforeEach;

import org.junit.jupiter.api.Test;



import static org.assertj.core.api.Assertions.assertThat;



class TailorResumeHtmlRendererTest {



    private TailorResumeHtmlRenderer renderer;

    private final ObjectMapper mapper = new ObjectMapper();



    @BeforeEach

    void setUp() throws Exception {

        renderer = new TailorResumeHtmlRenderer();

    }



    @Test

    void render_version2HeaderUsesNameJobTitleAndPreamble() throws Exception {

        User user = User.builder()

            .name("Yugandhar Reddy Bana")

            .email("banayugandhar8@outlook.com")

            .build();

        UserProfile profile = new UserProfile();

        profile.setLocation("Dublin, Ireland");



        Job job = new Job();

        job.setTitle("Senior Full Stack Developer");



        ArrayNode sections = mapper.createArrayNode();

        sections.add(section("Header", """

            Yugandhar Reddy Bana

            Full Stack Software Engineer

            T: +353 89 485 1413 | E: banayugandhar8@outlook.com | Dublin, Ireland

            https://linkedin.com/in/yugandhar | https://github.com/yugandhar | https://portfolio.example.com

            """, ""));

        sections.add(section("Professional summary", "orig", "Tailored summary only."));



        String html = renderer.render(user, profile, job, null, "Tailored summary only.", sections);



        assertThat(html).contains("Yugandhar Reddy Bana");

        assertThat(html).contains("Senior Full Stack Developer");

        assertThat(html).doesNotContain("<h1>Full Stack Developer</h1>");

        assertThat(html).contains("<strong>T:</strong>");

        assertThat(html).contains("mailto:banayugandhar8@outlook.com");

        assertThat(html).contains(">LinkedIn</a>");

        assertThat(html).contains("text-align: justify");

    }



    @Test

    void render_skipsRawCvDumpSection() throws Exception {

        UserProfile profile = new UserProfile();



        ArrayNode sections = mapper.createArrayNode();

        sections.add(section("CV", "full upload", "Yugandhar\nbanayugandhar8@outlook.com\nPROFESSIONAL SUMMARY\nLong text…"));

        sections.add(section("Professional summary", "orig", "Tailored summary only."));



        String html = renderer.render(profile, "Tailored summary only.", sections);



        assertThat(html).contains("Tailored summary only.");

        assertThat(html).doesNotContain("banayugandhar8@outlook.com");

        assertThat(html).doesNotContain("<h2>CV</h2>");

    }



    @Test

    void render_includesEverySectionFromResumeMdInOrder() throws Exception {

        User user = User.builder().name("Jane Doe").build();

        UserProfile profile = new UserProfile();

        profile.setLocation("Dublin, Ireland");



        Job job = new Job();

        job.setTitle("Software Engineer");



        ArrayNode sections = mapper.createArrayNode();

        sections.add(section("Professional summary", "Original summary", "Tailored three-sentence summary."));

        sections.add(section("Professional experience",

            "Dev at Acme",

            "Senior Dev — Acme\n2020–Present\n• Built React apps\n• Key Achievements:\n• Cut latency 40%"));

        sections.add(section("Skills",

            "Frontend: React",

            "Frontend: React, TypeScript, Redux\nBackend: Java, Spring Boot\nSoft Skills: Communication, Leadership"));

        sections.add(section("Education", "BSc CS", "BSc Computer Science | TU Dublin, 2019"));



        String html = renderer.render(user, profile, job, null, "Tailored three-sentence summary.", sections);



        assertThat(html).contains("Jane Doe");

        assertThat(html).contains("Software Engineer");

        assertThat(html).containsIgnoringCase("Professional Summary");

        assertThat(html).contains("Tailored three-sentence summary.");

        assertThat(html).contains("Frontend:");

        assertThat(html).contains("Soft Skills:");

        assertThat(html).contains("Spring Boot");

        assertThat(html).contains("TU Dublin");

        assertThat(html).doesNotContain("{{SECTIONS_BODY}}");

    }



    @Test

    void render_splitsMultipleRolesAndStripsHashFromBullets() throws Exception {

        User user = User.builder().name("Jane Doe").build();

        UserProfile profile = new UserProfile();



        String experience = """

            Full Stack Software Developer Sept 2024 – Present

            Independent Developer | Dublin, Ireland

            • # Building production apps end to end.

            Full Stack Software Developer Apr 2024 – Sept 2024

            Freelance Developer | Dublin, Ireland

            ▪ # React contract work.

            Software Engineer Aug 2021 – Jan 2024

            Incedo Technologies | Hyderabad, India

            • # Optimised search by 67%.

            """;



        ArrayNode sections = mapper.createArrayNode();

        sections.add(section("Professional experience", "orig", experience));



        String html = renderer.render(user, profile, null, "Developer", "", sections);



        assertThat(html).contains("experience-entry");

        assertThat(html).contains("Sept 2024 – Present");

        assertThat(html).contains("Apr 2024 – Sept 2024");

        assertThat(html).contains("Aug 2021 – Jan 2024");

        assertThat(html).contains("Independent Developer | Dublin, Ireland");

        assertThat(html).contains("Building production apps end to end.");

        assertThat(html).doesNotContain("# Building");

        assertThat(html).doesNotContain("# React");

        assertThat(html.split("class=\"entry experience-entry\"")).hasSize(4);

        assertThat(html).doesNotContain("<li>Full Stack Software Developer");

    }



    @Test

    void normalizeBulletText_stripsLeadingHash() {

        assertThat(TailorResumeHtmlRenderer.normalizeBulletText("• # Building apps"))

            .isEqualTo("Building apps");

        assertThat(TailorResumeHtmlRenderer.normalizeBulletText("# Optimised search"))

            .isEqualTo("Optimised search");

    }



    private static ObjectNode section(String name, String original, String rewritten) {

        ObjectNode row = new ObjectMapper().createObjectNode();

        row.put("name", name);

        row.put("original", original);

        row.put("rewritten", rewritten);

        row.put("rationale", "Tailored for JD keywords.");

        return row;

    }

}


