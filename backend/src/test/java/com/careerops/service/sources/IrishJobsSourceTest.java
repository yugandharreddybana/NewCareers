package com.careerops.service.sources;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class IrishJobsSourceTest {

    @Test
    @DisplayName("extract company from standard URL slug")
    void extractCompanyFromUrl_standard() {
        assertThat(IrishJobsSource.extractCompanyFromUrl(
            "/job/software-engineer/google-ireland-ltd-job107389008"))
            .isEqualTo("Google Ireland LTD");
    }

    @Test
    @DisplayName("extract company handles multi-word names")
    void extractCompanyFromUrl_multiWord() {
        assertThat(IrishJobsSource.extractCompanyFromUrl(
            "/job/senior-software-engineer/j-p-morgan-s-e-dublin-branch-job107331437"))
            .isEqualTo("J P Morgan S E Dublin Branch");
    }

    @Test
    @DisplayName("extract company handles simple names")
    void extractCompanyFromUrl_simple() {
        assertThat(IrishJobsSource.extractCompanyFromUrl(
            "/job/software-engineer/druid-software-job107234479"))
            .isEqualTo("Druid Software");
    }

    @Test
    @DisplayName("extract company returns Unknown for unparseable URL")
    void extractCompanyFromUrl_unparseable() {
        assertThat(IrishJobsSource.extractCompanyFromUrl(""))
            .isEqualTo("Unknown");
        assertThat(IrishJobsSource.extractCompanyFromUrl("/job/title-only"))
            .isNotBlank();
    }

    @Test
    @DisplayName("extract company handles recruiters and consultancies")
    void extractCompanyFromUrl_recruiter() {
        assertThat(IrishJobsSource.extractCompanyFromUrl(
            "/job/senior-software-engineer/mcs-group-consultancy-job107208805"))
            .isEqualTo("MCS Group Consultancy");
    }
}
