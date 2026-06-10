package com.careerops.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ParagraphTextTest {

    @Test
    void splitBlankLineParagraphs_splitsOnDoubleNewline() {
        String letter = "Dear Manager,\n\nFirst body paragraph.\n\nSecond body paragraph.\n\nYours sincerely,\nAlex";
        List<String> paragraphs = ParagraphText.splitBlankLineParagraphs(letter);

        assertThat(paragraphs).hasSize(4);
        assertThat(paragraphs.get(0)).isEqualTo("Dear Manager,");
        assertThat(paragraphs.get(1)).isEqualTo("First body paragraph.");
        assertThat(paragraphs.get(3)).contains("Alex");
    }

    @Test
    void splitBlankLineParagraphs_treatsWhitespaceBetweenNewlinesAsOneBreak() {
        String letter = "Dear Team,\n \n\nBody here.\n\n  \nRegards";
        List<String> paragraphs = ParagraphText.splitBlankLineParagraphs(letter);

        assertThat(paragraphs).hasSize(3);
        assertThat(paragraphs.get(0)).isEqualTo("Dear Team,");
        assertThat(paragraphs.get(1)).isEqualTo("Body here.");
        assertThat(paragraphs.get(2)).isEqualTo("Regards");
    }

    @Test
    void splitBlankLineParagraphs_normalizesCarriageReturns() {
        String letter = "Dear Hiring Manager,\r\n\r\nI am a strong fit.\r\n\r\nYours sincerely,\r\nJane";
        assertThat(ParagraphText.splitBlankLineParagraphs(letter)).hasSize(3);
    }

    @Test
    void splitBlankLineParagraphs_returnsEmptyForBlankInput() {
        assertThat(ParagraphText.splitBlankLineParagraphs("")).isEmpty();
        assertThat(ParagraphText.splitBlankLineParagraphs("   ")).isEmpty();
        assertThat(ParagraphText.splitBlankLineParagraphs(null)).isEmpty();
    }
}
