package com.careerops.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CvDateRangeParserTest {

    @Test
    void parse_presentRole() {
        var dates = CvDateRangeParser.parse("Sept 2024 – Present");
        assertThat(dates.startDate()).isEqualTo("2024-09");
        assertThat(dates.endDate()).isEmpty();
        assertThat(dates.current()).isTrue();
    }

    @Test
    void parse_monthRange() {
        var dates = CvDateRangeParser.parse("Aug 2021 – Jan 2024");
        assertThat(dates.startDate()).isEqualTo("2021-08");
        assertThat(dates.endDate()).isEqualTo("2024-01");
        assertThat(dates.current()).isFalse();
    }

    @Test
    void parse_yearOnlyRange() {
        var dates = CvDateRangeParser.parse("2020 - 2022");
        assertThat(dates.startDate()).isEqualTo("2020-01");
        assertThat(dates.endDate()).isEqualTo("2022-01");
        assertThat(dates.current()).isFalse();
    }

    @Test
    void parse_currentKeyword() {
        var dates = CvDateRangeParser.parse("Jan 2023 - Current");
        assertThat(dates.startDate()).isEqualTo("2023-01");
        assertThat(dates.current()).isTrue();
    }
}
