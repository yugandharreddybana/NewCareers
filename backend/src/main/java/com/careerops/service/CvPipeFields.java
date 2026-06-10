package com.careerops.service;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Shared heuristics for pipe-delimited CV fields (company | location, title | link, etc.).
 */
final class CvPipeFields {

    private static final Pattern PIPE_SPLIT = Pattern.compile("\\s*\\|\\s*");

    private static final Pattern URL_PATTERN = Pattern.compile(
        "(?i)(https?://[^\\s<>\"']+|(?:www\\.)?github\\.com/[\\w.\\-/%]+|"
            + "(?:www\\.)?gitlab\\.com/[\\w.\\-/%]+|(?:www\\.)?bitbucket\\.org/[\\w.\\-/%]+)"
    );

    private static final Pattern DEGREE_HINT = Pattern.compile(
        "(?i)\\b(B\\.?\\s*Tech\\.?|B\\.?E\\.?|B\\.?S\\.?c?\\.?|B\\.?A\\.?|M\\.?S\\.?c?\\.?|M\\.?Tech\\.?|"
            + "M\\.?A\\.?|M\\.?B\\.?A\\.?|Ph\\.?D\\.?|Bachelor|Master|Doctor|Diploma|Certificate|"
            + "B\\.?Eng\\.?|M\\.?Eng\\.?|Associate|HND|LLB|PGDip|PG Dip)\\b"
    );

    private static final Pattern YEAR_IN_TEXT = Pattern.compile("\\b(19|20)\\d{2}\\b");

    private static final Pattern PIPE_TITLE = Pattern.compile("^(.+?)\\s*\\|\\s*(.+)$");

    private CvPipeFields() {}

    record TwoPart(String left, String right) {}

    record EducationPipeParts(String degree, String school, String yearOrLocation) {}

    record ProjectPipeParts(String title, String url, String location) {}

    static TwoPart splitCompanyLocation(String text) {
        if (text == null || !text.contains("|")) {
            return new TwoPart(text != null ? text.trim() : "", "");
        }
        String[] parts = PIPE_SPLIT.split(text.trim(), 2);
        if (parts.length < 2) {
            return new TwoPart(parts[0].trim(), "");
        }
        String left = parts[0].trim();
        String right = parts[1].trim();
        if (looksLikeLocationSegment(right)) {
            return new TwoPart(left, right);
        }
        return new TwoPart(text.trim(), "");
    }

    static boolean looksLikeLocationSegment(String segment) {
        if (segment == null || segment.isBlank()) {
            return false;
        }
        String t = segment.trim();
        if (isLinkPlaceholder(t) || URL_PATTERN.matcher(t).find()) {
            return false;
        }
        String lower = t.toLowerCase(Locale.ROOT);
        if (lower.equals("remote") || lower.equals("hybrid") || lower.contains("ireland")
            || lower.contains("india") || lower.contains("hyderabad") || lower.contains("dublin")
            || lower.contains("london") || lower.contains(" uk") || lower.endsWith(" uk")) {
            return true;
        }
        if (t.contains(",")) {
            return true;
        }
        return t.matches("^[A-Z][a-zA-Z .,'-]{1,56}$") && !DEGREE_HINT.matcher(t).find();
    }

    static ProjectPipeParts splitProjectTitleLink(String line) {
        if (line == null || line.isBlank()) {
            return new ProjectPipeParts("", "", "");
        }
        Matcher pipe = PIPE_TITLE.matcher(line.trim());
        if (!pipe.matches()) {
            return new ProjectPipeParts(line.trim(), "", "");
        }
        String left = pipe.group(1).trim();
        String right = pipe.group(2).trim();
        if (URL_PATTERN.matcher(right).find()) {
            Matcher urlMatcher = URL_PATTERN.matcher(right);
            urlMatcher.find();
            return new ProjectPipeParts(left, ProjectLinkExtractor.normalizeUrl(urlMatcher.group(1)), "");
        }
        if (isLinkPlaceholder(right)) {
            return new ProjectPipeParts(left, "", "");
        }
        if (looksLikeLocationSegment(right)) {
            return new ProjectPipeParts(left, "", right);
        }
        return new ProjectPipeParts(left, "", "");
    }

    static boolean looksLikeProjectPipeTitle(String line) {
        if (line == null || line.isBlank()) {
            return false;
        }
        Matcher pipe = PIPE_TITLE.matcher(line.trim());
        if (!pipe.matches()) {
            return false;
        }
        String left = pipe.group(1).trim();
        String right = pipe.group(2).trim();
        return !left.isBlank()
            && (isLinkPlaceholder(right) || URL_PATTERN.matcher(right).find() || looksLikeLocationSegment(right));
    }

    static EducationPipeParts parseEducationPipeParts(String[] parts) {
        String degree = "";
        String school = "";
        String third = "";
        if (parts == null || parts.length == 0) {
            return new EducationPipeParts("", "", "");
        }
        String p0 = parts[0].trim();
        String p1 = parts.length >= 2 ? parts[1].trim() : "";
        String p2 = parts.length >= 3 ? parts[2].trim() : "";

        boolean firstIsDegree = DEGREE_HINT.matcher(p0).find();
        boolean secondIsDegree = !p1.isBlank() && DEGREE_HINT.matcher(p1).find();

        if (firstIsDegree && !secondIsDegree) {
            degree = p0;
            school = p1;
            third = p2;
        } else if (!firstIsDegree && secondIsDegree) {
            school = p0;
            degree = p1;
            third = p2;
        } else if (firstIsDegree) {
            degree = p0;
            school = p1;
            third = p2;
        } else {
            school = p0;
            degree = p1;
            third = p2;
        }
        return new EducationPipeParts(degree, school, third);
    }

    static String extractYearFromSegment(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        Matcher any = YEAR_IN_TEXT.matcher(text);
        String last = "";
        while (any.find()) {
            last = any.group();
        }
        return last;
    }

    private static boolean isLinkPlaceholder(String value) {
        String lower = value.toLowerCase(Locale.ROOT);
        return lower.equals("link") || lower.equals("demo") || lower.equals("url") || lower.equals("live");
    }

}
