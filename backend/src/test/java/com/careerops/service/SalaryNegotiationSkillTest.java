package com.careerops.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.when;

/**
 * Task 139 — SalaryNegotiationSkill tests
 * Covers: prompt includes role + YOE + location,
 *         result parsing returns all required fields.
 */
@ExtendWith(MockitoExtension.class)
class SalaryNegotiationSkillTest {

    @Mock  private GeminiClient geminiClient;
    @InjectMocks private SalaryNegotiationSkill skill;

    private static final String ROLE     = "Senior Frontend Engineer";
    private static final int    YOE      = 5;
    private static final String LOCATION = "Dublin";

    // ── 1. Prompt must contain role, YOE, and location ─────────────────────
    @Test
    @DisplayName("prompt — includes role, years of experience, and location")
    void prompt_includesRoleYoeAndLocation() {
        when(geminiClient.generate(argThat(prompt ->
            prompt.contains(ROLE) &&
            prompt.contains(String.valueOf(YOE)) &&
            prompt.contains(LOCATION)
        ))).thenReturn("{\"strategy\":\"anchor\",\"range\":\"€75k–€90k\",\"talking_points\":[\"t1\"],\"scripts\":[\"s1\"],\"dos\":[\"d1\"],\"donts\":[\"dn1\"]}");

        SalaryNegotiationResult result = skill.run(ROLE, YOE, LOCATION, 70000, 90000);

        assertThat(result).isNotNull();
    }

    // ── 2. Result parsing returns all required fields ──────────────────────
    @Test
    @DisplayName("result parsing — all required fields present")
    void resultParsing_allRequiredFieldsPresent() {
        when(geminiClient.generate(argThat(s -> s.contains(ROLE))))
            .thenReturn("{" +
                "\"strategy\":\"anchor high\"" +
                ",\"range\":\"€80k–€95k\"" +
                ",\"talking_points\":[\"3 years at scale\"]" +
                ",\"scripts\":[\"I was expecting something in the €80k range\"]" +
                ",\"dos\":[\"Research market rate\"]" +
                ",\"donts\":[\"Don't reveal your floor\"]"
                + "}");

        SalaryNegotiationResult result = skill.run(ROLE, YOE, LOCATION, 70000, 100000);

        assertThat(result.getStrategy()).isNotBlank();
        assertThat(result.getRange()).isNotBlank();
        assertThat(result.getTalkingPoints()).isNotEmpty();
        assertThat(result.getScripts()).isNotEmpty();
        assertThat(result.getDos()).isNotEmpty();
        assertThat(result.getDonts()).isNotEmpty();
    }
}
