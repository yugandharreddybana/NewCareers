package com.careerops.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class LinkedInDescriptionHelperTest {

  private final ObjectMapper mapper = new ObjectMapper();

  @Test
  void extractJobId_fromViewUrl() {
    Optional<String> id = LinkedInDescriptionHelper.extractJobId(
        "https://www.linkedin.com/jobs/view/senior-engineer-at-acme-3856789012");
    assertThat(id).contains("3856789012");
  }

  @Test
  void htmlToPlainText_stripsTags() throws Exception {
    String html = mapper.readTree("""
        {"description":"<p>We are hiring a senior engineer to build scalable web apps with React and TypeScript across our Dublin product team and partner with design.</p>"}
        """).path("description").asText();
    String text = LinkedInDescriptionHelper.htmlToPlainText(html);
    assertThat(text).contains("senior engineer");
  }

  @Test
  void parseGuestResponseBody_fromHtmlFragment() {
    String html = """
        <div class="show-more-less-html__markup">
          <p>We are hiring a senior engineer to build scalable web apps with React and TypeScript
          across our Dublin product team and partner with design on customer-facing features.</p>
        </div>
        """;
    String text = LinkedInDescriptionHelper.parseGuestResponseBody(html, mapper);
    assertThat(text).contains("senior engineer");
  }
}
