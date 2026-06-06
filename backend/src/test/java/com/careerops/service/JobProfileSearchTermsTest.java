package com.careerops.service;

import com.careerops.model.UserProfile;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class JobProfileSearchTermsTest {

    @Test
    void searchKeywords_includesAllRolesThenHeadline_deduped() {
        UserProfile p = new UserProfile();
        p.setTargetRoles(new String[] { "Software Engineer", "Backend Developer" });
        p.setGoalTitle("Software Engineer");

        List<String> keys = JobProfileSearchTerms.searchKeywords(p);

        assertThat(keys).containsExactly("Software Engineer", "Backend Developer");
    }

    @Test
    void searchKeywords_addsHeadlineWhenDistinct() {
        UserProfile p = new UserProfile();
        p.setTargetRoles(new String[] { "Data Analyst" });
        p.setGoalTitle("Senior Analytics Lead");

        assertThat(JobProfileSearchTerms.searchKeywords(p))
                .containsExactly("Data Analyst", "Senior Analytics Lead");
    }

    @Test
    void primaryKeyword_fallsBackWhenEmpty() {
        assertThat(JobProfileSearchTerms.primaryKeyword(new UserProfile())).isEqualTo("software engineer");
    }
}
