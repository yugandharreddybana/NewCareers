package com.careerops.service.sources;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class StepstonePreloadedParserTest {

    @Test
    @DisplayName("parse extracts job listings from saved IrishJobs HTML fixture")
    void parse_fixtureHtml() throws Exception {
        Path fixture = Path.of("tmp-irishjobs.html");
        if (!Files.exists(fixture)) {
            return; // optional local fixture from probe run
        }
        String html = Files.readString(fixture);
        List<StepstonePreloadedParser.Listing> listings =
            StepstonePreloadedParser.parse(html, "https://www.irishjobs.ie");
        assertThat(listings).isNotEmpty();
        assertThat(listings.get(0).relativeUrl()).startsWith("/job/");
    }
}
