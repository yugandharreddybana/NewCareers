package com.careerops.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EducationSectionParserTest {

    @Test
    void parseEntries_degreeFirstCommaLine() {
        var entries = EducationSectionParser.parseEntries("""
            BSc Computer Science, Trinity College Dublin, 2020
            """);
        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).degree()).containsIgnoringCase("BSc");
        assertThat(entries.get(0).schoolName()).containsIgnoringCase("Trinity");
        assertThat(entries.get(0).graduationYear()).isEqualTo("2020");
    }

    @Test
    void parseEntries_schoolFirstCommaLine() {
        var entries = EducationSectionParser.parseEntries("""
            Trinity College Dublin, BSc Computer Science, 2020
            """);
        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).schoolName()).containsIgnoringCase("Trinity");
        assertThat(entries.get(0).degree()).containsIgnoringCase("BSc");
        assertThat(entries.get(0).graduationYear()).isEqualTo("2020");
    }

    @Test
    void parseEntries_bTechLine() {
        var entries = EducationSectionParser.parseEntries("""
            B.Tech Computer Science, IIT Delhi, 2019
            """);
        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).degree()).containsIgnoringCase("B.Tech");
        assertThat(entries.get(0).schoolName()).containsIgnoringCase("IIT");
        assertThat(entries.get(0).fieldOfStudy()).containsIgnoringCase("Computer Science");
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

    @Test
    void parseEntries_parenLocation() {
        var entries = EducationSectionParser.parseEntries("""
            MSc Data Science, University College Dublin (Dublin), 2022
            """);
        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).location()).isEqualTo("Dublin");
    }

    @Test
    void parseEntries_relatedCoursesBulletsStayInParentBlock() {
        var entries = EducationSectionParser.parseEntries("""
            M.Sc Computer Science, National University of Ireland, 2021
            Related Courses:
            • Data Visualisation
            • JavaScript

            B.Tech Information Technology, Dublin Institute of Technology, 2019
            """);
        assertThat(entries).hasSize(2);
        assertThat(entries.get(0).schoolName()).containsIgnoringCase("National University");
        assertThat(entries.get(0).degree()).containsIgnoringCase("M.Sc");
        assertThat(entries.get(0).fieldOfStudy()).containsIgnoringCase("Data Visualisation");
        assertThat(entries.get(1).schoolName()).containsIgnoringCase("Dublin Institute");
    }

    @Test
    void parseEntries_courseOnlyBulletsDoNotBecomeEntries() {
        var entries = EducationSectionParser.parseEntries("""
            Data Visualisation
            Related Courses: Machine Learning
            JavaScript
            """);
        assertThat(entries).isEmpty();
    }

    @Test
    void parseEntries_multilineDegreeThenCollege() {
        var entries = EducationSectionParser.parseEntries("""
            Master of Science in Data Analytics
            Atlantic Technological University
            2020 - 2022
            """);
        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).degree()).containsIgnoringCase("Master");
        assertThat(entries.get(0).schoolName()).containsIgnoringCase("Atlantic Technological University");
        assertThat(entries.get(0).graduationYear()).isEqualTo("2022");
    }

    @Test
    void parseEntries_pipeDegreeSchoolYear() {
        var entries = EducationSectionParser.parseEntries("""
            M.Sc | National University of Ireland Galway | 2021
            """);
        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).degree()).containsIgnoringCase("M.Sc");
        assertThat(entries.get(0).schoolName()).containsIgnoringCase("National University");
        assertThat(entries.get(0).graduationYear()).isEqualTo("2021");
    }

    @Test
    void parseEntries_pipeSchoolDegreeYear() {
        var entries = EducationSectionParser.parseEntries("""
            NUIG | M.Sc Computer Science | 2021
            """);
        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).schoolName()).containsIgnoringCase("NUIG");
        assertThat(entries.get(0).degree()).containsIgnoringCase("M.Sc");
        assertThat(entries.get(0).graduationYear()).isEqualTo("2021");
    }
}
