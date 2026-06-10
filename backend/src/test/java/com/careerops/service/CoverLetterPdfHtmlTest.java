package com.careerops.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CoverLetterPdfHtmlTest {

    @Test
    void buildLetterBodyHtml_emitsOneParagraphElementPerBlankLineSplit() {
        String letter =
                "Dear Hiring Manager,\n\n"
                        + "I am writing to apply for the Java role.\n\n"
                        + "My experience includes Spring Boot and AWS.\n\n"
                        + "Yours sincerely,\nJane Doe";

        String bodyHtml = CoverLetterPdfHtml.buildLetterBodyHtml(letter);

        assertThat(bodyHtml.split("<p style=").length - 1).isEqualTo(4);
        assertThat(bodyHtml).contains("Dear Hiring Manager,");
        assertThat(bodyHtml).contains("I am writing to apply");
        assertThat(bodyHtml).contains("Jane Doe");
    }

    @Test
    void buildDocument_includesTitleAndMultipleLetterParagraphs() {
        String letter = "Dear Team,\n\nParagraph one.\n\nParagraph two.\n\nRegards,\nSam";
        String doc = CoverLetterPdfHtml.buildDocument(letter, "Engineer", "Acme");

        assertThat(doc).contains("<h1>Cover Letter</h1>");
        assertThat(doc).contains("Engineer · Acme");
        assertThat(doc.split("<p style=").length - 1).isGreaterThanOrEqualTo(3);
    }

    @Test
    void buildLetterBodyHtml_preservesSingleNewlinesWithinClosingAsBr() {
        String letter = "Dear Manager,\n\nBody text.\n\nYours sincerely,\nAlex Smith";
        String bodyHtml = CoverLetterPdfHtml.buildLetterBodyHtml(letter);

        assertThat(bodyHtml).contains("Yours sincerely,<br/>Alex Smith");
    }
}
