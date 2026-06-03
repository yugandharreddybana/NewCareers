package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.User;
import com.careerops.model.UserProfile;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CvHeaderParserTest {

    @Test
    void parse_extractsPhoneEmailLocationAndUrls() {
        User user = User.builder()
            .name("Yugandhar Reddy Bana")
            .email("banayugandhar8@outlook.com")
            .build();
        UserProfile profile = new UserProfile();
        profile.setLocation("Dublin, Ireland");

        String header = """
            Yugandhar Reddy Bana
            Full Stack Software Engineer
            T: +353 89 485 1413 | E: banayugandhar8@outlook.com | Dublin, Ireland
            https://linkedin.com/in/yugandhar | https://github.com/yugandhar | https://portfolio.example.com
            """;

        CvHeaderParser.HeaderData data = CvHeaderParser.parse(header, user, profile);

        assertThat(data.phone()).contains("+353");
        assertThat(data.email()).isEqualTo("banayugandhar8@outlook.com");
        assertThat(data.location()).isEqualTo("Dublin, Ireland");
        assertThat(data.linkedInUrl()).contains("linkedin.com");
        assertThat(data.githubUrl()).contains("github.com");
        assertThat(data.portfolioUrl()).contains("portfolio.example.com");
    }

    @Test
    void buildPreambleHtml_rendersTwoRowsWithLinks() {
        CvHeaderParser.HeaderData data = new CvHeaderParser.HeaderData(
            "Yugandhar Reddy Bana",
            "+353 89 485 1413",
            "banayugandhar8@outlook.com",
            "Dublin, Ireland",
            "https://linkedin.com/in/yugandhar",
            "https://github.com/yugandhar",
            "https://portfolio.example.com"
        );

        String html = CvHeaderParser.buildPreambleHtml(data);

        assertThat(html).contains("contact-row");
        assertThat(html).contains("<strong>T:</strong>");
        assertThat(html).contains("mailto:banayugandhar8@outlook.com");
        assertThat(html).contains("Dublin, Ireland");
        assertThat(html).contains("links-row");
        assertThat(html).contains(">LinkedIn</a>");
        assertThat(html).contains(">GitHub</a>");
        assertThat(html).contains(">Portfolio</a>");
    }

    @Test
    void resolveName_prefersUserRecord() {
        User user = User.builder().name("Yugandhar Reddy Bana").build();
        CvHeaderParser.HeaderData header = new CvHeaderParser.HeaderData(
            "Other Name", "", "", "", "", "", "");

        assertThat(CvHeaderParser.resolveName(user, header)).isEqualTo("Yugandhar Reddy Bana");
    }

    @Test
    void resolveContactLine_prefersJobTitle() {
        Job job = new Job();
        job.setTitle("Senior Full Stack Developer");
        UserProfile profile = new UserProfile();
        profile.setGoalTitle("Full Stack Developer");

        assertThat(CvHeaderParser.resolveContactLine(job.getTitle(), profile))
            .isEqualTo("Senior Full Stack Developer");
    }
}
