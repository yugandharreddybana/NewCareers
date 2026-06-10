package com.careerops.service;

import java.util.regex.Pattern;

/**
 * Inserts line breaks before common job-posting section labels so plain-text descriptions
 * render with structure instead of one wall of text.
 */
public final class JobDescriptionNormalizer {

    private static final Pattern INLINE_SECTION = Pattern.compile(
            "(?i)\\s+(?=(?:Salary|Compensation|Pay|Hybrid|Remote|On-site|On site|Location|"
                    + "About(?: the)?(?: role| us| company)?|Responsibilities|Requirements|"
                    + "Must have|Nice to have|Tech stack|Technology stack|Benefits|"
                    + "What you(?:'|')?ll do|What we offer|Key skills|Qualifications|"
                    + "The role|Your role|Job description|Overview)\\s*:)");

    private static final Pattern INLINE_BULLET = Pattern.compile(
            "\\s+([•\\-*])\\s+");

    private static final Pattern INLINE_NUMBERED = Pattern.compile(
            "\\s+(\\d+[.)])\\s+");

    static final String SALARY_SCAN_MARKER = "<!-- salary-scan:done -->";

    private static final Pattern SALARY_SCAN_MARKER_PATTERN =
            Pattern.compile("\\n?" + Pattern.quote(SALARY_SCAN_MARKER) + "\\s*");

    private JobDescriptionNormalizer() {}

    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            return raw;
        }
        String text = raw.replace('\u00a0', ' ')
                .replaceAll("(?i)\\bshow\\s+more\\b", "")
                .replaceAll("(?i)\\bshow\\s+less\\b", "")
                .replaceAll("[ \\t]+", " ")
                .trim();

        if (!text.contains("\n") && text.length() > 200) {
            text = INLINE_SECTION.matcher(text).replaceAll("\n\n");
            text = INLINE_BULLET.matcher(text).replaceAll("\n$1 ");
            text = INLINE_NUMBERED.matcher(text).replaceAll("\n$1 ");
        }

        text = SALARY_SCAN_MARKER_PATTERN.matcher(text).replaceAll("");
        return text.replaceAll("\\n{3,}", "\n\n").trim();
    }
}
