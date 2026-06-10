package com.careerops.service;

import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Splits plain text where paragraphs are separated by blank lines ({@code \n\n}).
 */
public final class ParagraphText {

    private static final Pattern BLANK_LINE = Pattern.compile("\\n\\s*\\n");

    private ParagraphText() {}

    /**
     * Split on one or more blank lines. Trims each paragraph; drops empty segments.
     */
    public static List<String> splitBlankLineParagraphs(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }
        String normalized = text.replace("\r\n", "\n").trim();
        return Arrays.stream(BLANK_LINE.split(normalized))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
    }
}
