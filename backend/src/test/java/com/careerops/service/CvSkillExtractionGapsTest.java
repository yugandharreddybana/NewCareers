package com.careerops.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CvSkillExtractionGapsTest {

  private final CvSkillExtractionService extraction = new CvSkillExtractionService();

  @Test
  void gapsInJob_listsPostingSkillsMissingFromProfile() {
    String jd = "We need React.js, TypeScript, and AWS experience. Java is a plus.";
    List<String> user = List.of("React", "Java");
    List<String> gaps = extraction.gapsInJob(user, jd);
    assertThat(gaps).contains("TypeScript", "AWS");
    assertThat(gaps).doesNotContain("React", "Java");
  }

    @Test
    void reactJsAndReactCountAsMatchedNotGap() {
        String jd = "Required: react and node.js";
        List<String> user = List.of("React.js");
        List<String> gaps = extraction.gapsInJob(user, jd);
        assertThat(gaps).doesNotContain("React");
        assertThat(gaps).contains("Node.js");
    }

    @Test
    void githubActionsNotCanonicalizedAsGit() {
        assertThat(CvSkillCanonical.canonicalize("GitHub")).isEqualTo("GitHub");
        assertThat(CvSkillCanonical.canonicalize("GitHub Actions")).isEqualTo("GitHub Actions");
        assertThat(CvSkillCanonical.canonicalize("Git")).isEqualTo("Git");
    }
}
