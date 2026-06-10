package com.careerops.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JobSalaryExtractorTest {

    @Test
    void parseLabeledSalaryRange() {
        var info = JobSalaryExtractor.parse("Salary: €60,000 – €85,000 per annum\n\nRole details...");
        assertThat(info.min()).isEqualTo(60_000);
        assertThat(info.max()).isEqualTo(85_000);
        assertThat(info.currency()).isEqualTo("EUR");
    }

    @Test
    void parseBareEurRangeWithoutLabel() {
        var info = JobSalaryExtractor.parse("We offer €55,000 to €70,000 DOE for this hybrid role.");
        assertThat(info.min()).isEqualTo(55_000);
        assertThat(info.max()).isEqualTo(70_000);
    }

    @Test
    void parseSingleEurAmount() {
        var info = JobSalaryExtractor.parse("Package: €65,000 per annum plus benefits.");
        assertThat(info.min()).isEqualTo(65_000);
        assertThat(info.max()).isNull();
    }

    @Test
    void parseJsonLdBaseSalary() {
        String html = """
                <html><body>
                <script type="application/ld+json">
                {"@type":"JobPosting","title":"Engineer","baseSalary":{"@type":"MonetaryAmount","currency":"EUR",
                "value":{"@type":"QuantitativeValue","minValue":50000,"maxValue":75000,"unitText":"YEAR"}}}
                </script>
                </body></html>
                """;
        var info = JobSalaryExtractor.parseFromHtml(html);
        assertThat(info.min()).isEqualTo(50_000);
        assertThat(info.max()).isEqualTo(75_000);
        assertThat(info.currency()).isEqualTo("EUR");
    }

    @Test
    void ignoresCompetitiveWithoutAmount() {
        var info = JobSalaryExtractor.parse("Salary: Competitive\n\nGreat team.");
        assertThat(info.hasStructured()).isFalse();
    }

    @Test
    void parsePreloadedJobAdvertSalaryObject() {
        String html = """
                <html><body>
                <script>
                window.__PRELOADED_STATE__["app-jobAdvert"] = {
                  "job": {
                    "title": "Java Developer",
                    "salary": {
                      "displayValue": "€60,000 - €85,000",
                      "min": 60000,
                      "max": 85000,
                      "currency": "EUR"
                    }
                  }
                };
                </script>
                </body></html>
                """;
        var info = JobSalaryExtractor.parseFromHtml(html);
        assertThat(info.min()).isEqualTo(60_000);
        assertThat(info.max()).isEqualTo(85_000);
        assertThat(info.currency()).isEqualTo("EUR");
    }
}
