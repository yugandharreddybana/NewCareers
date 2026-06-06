package com.careerops.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EducationSectionParserTest {

    @Test
    void parseEntries_commaSeparatedLine() {
        var entries = EducationSectionParser.parseEntries("""
            BSc Computer Science, Trinity College Dublin, 2020
            """);
        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).degree()).containsIgnoringCase("BSc");
        assertThat(entries.get(0).schoolName()).containsIgnoringCase("Trinity");
        assertThat(entries.get(0).graduationYear()).isEqualTo("2020");
    }

    @Test
    void parseEntries_multilineBlocks() {
        var entries = EducationSectionParser.parseEntries("""
            Bachelor of Science in Computer Science
            University College Dublin
            2016 - 2020

            MSc Data Science
            TU Dublin | 2021
            """);
        assertThat(entries).hasSize(2);
        assertThat(entries.get(0).schoolName()).containsIgnoringCase("Dublin");
        assertThat(entries.get(0).graduationYear()).isEqualTo("2020");
        assertThat(entries.get(1).degree()).containsIgnoringCase("MSc");
    }
}
