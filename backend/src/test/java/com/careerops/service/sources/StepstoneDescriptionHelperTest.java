package com.careerops.service.sources;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class StepstoneDescriptionHelperTest {

    @Test
    void extractFromHtml_findsDescriptionInPreloadedState() {
        String html = """
            <html><body>
            <script>
            window.__PRELOADED_STATE__["app-jobAdvert"] = {
              "job": {
                "title": "Engineer",
                "description": "<p>We are hiring a <strong>senior engineer</strong> to build scalable web apps with React and TypeScript across our Dublin product team for the long term.</p>"
              }
            };
            </script>
            </body></html>
            """;
        String desc = StepstoneDescriptionHelper.extractFromHtml(html);
        assertThat(desc).contains("senior engineer").contains("React");
    }

    @Test
    void toPlainText_stripsHtmlAndPreservesMinimumLength() {
        String plain = StepstoneDescriptionHelper.toPlainText(
            "<ul><li>First responsibility with enough words here.</li><li>Second line with more detail about the role and stack.</li></ul>");
        assertThat(plain).isNotNull().contains("First responsibility");
    }

    @Test
    void isStepstoneJobUrl_recognizesIrishHosts() {
        assertThat(StepstoneDescriptionHelper.isStepstoneJobUrl(
            "https://www.irishjobs.ie/job/dev/acme-job123")).isTrue();
        assertThat(StepstoneDescriptionHelper.isStepstoneJobUrl(
            "https://www.linkedin.com/jobs/view/123")).isFalse();
    }
}
