package com.careerops.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses plain-text education sections into structured entries.
 */
final class EducationSectionParser {

    private static final int MAX_ENTRIES = 10;

    private static final Pattern BULLET_LINE = Pattern.compile("^[•\\-*▪►#]\\s*");

    private static final Pattern TRAILING_YEAR = Pattern.compile(
        "\\b(19|20)\\d{2}\\s*$"
    );

    private static final Pattern YEAR_RANGE = Pattern.compile(
        "\\b(19|20)\\d{2}\\s*[-–—]\\s*((?:19|20)\\d{2}|Present|Current)\\b",
        Pattern.CASE_INSENSITIVE
    );

    private static final Pattern DEGREE_HINT = Pattern.compile(
        "(?i)\\b(B\\.?S\\.?c?|B\\.?A\\.?|M\\.?S\\.?c?|M\\.?A\\.?|M\\.?B\\.?A\\.?|Ph\\.?D\\.?|"
            + "Bachelor|Master|Doctor|Diploma|Certificate|B\\.?Eng\\.?|M\\.?Eng\\.?)\\b"
    );

    private EducationSectionParser() {}

    record ParsedEducation(String degree, String schoolName, String fieldOfStudy, String graduationYear) {}

    static List<ParsedEducation> parseEntries(String body) {
        if (body == null || body.isBlank()) {
            return List.of();
        }
        List<String> blocks = splitBlocks(body);
        List<ParsedEducation> out = new ArrayList<>();
        for (String block : blocks) {
            ParsedEducation entry = parseBlock(block);
            if (hasContent(entry)) {
                out.add(entry);
            }
            if (out.size() >= MAX_ENTRIES) {
                break;
            }
        }
        return out;
    }

    private static List<String> splitBlocks(String body) {
        List<String> blocks = new ArrayList<>();
        List<String> current = new ArrayList<>();
        for (String raw : body.split("\\r?\\n")) {
            String line = raw.strip();
            if (line.isBlank()) {
                if (!current.isEmpty()) {
                    blocks.add(String.join("\n", current).trim());
                    current = new ArrayList<>();
                }
                continue;
            }
            if (BULLET_LINE.matcher(line).find() && !current.isEmpty()) {
                blocks.add(String.join("\n", current).trim());
                current = new ArrayList<>();
            }
            current.add(line.replaceFirst("^[•\\-*▪►#]+\\s*", "").trim());
        }
        if (!current.isEmpty()) {
            blocks.add(String.join("\n", current).trim());
        }
        if (blocks.size() <= 1 && body.contains("|")) {
            return splitPipeLines(body);
        }
        return blocks.isEmpty() ? List.of(body.trim()) : blocks;
    }

    private static List<String> splitPipeLines(String body) {
        List<String> lines = new ArrayList<>();
        for (String raw : body.split("\\r?\\n")) {
            String t = raw.strip();
            if (!t.isBlank()) {
                lines.add(t);
            }
        }
        return lines;
    }

    private static ParsedEducation parseBlock(String block) {
        String[] lines = block.split("\\r?\\n");
        String degree = "";
        String school = "";
        String field = "";
        String year = "";

        String primary = lines[0].strip();
        if (primary.contains("|")) {
            String[] parts = primary.split("\\|");
            if (parts.length >= 2) {
                school = parts[0].trim();
                degree = parts[1].trim();
                if (parts.length >= 3) {
                    year = extractYear(parts[2]);
                }
            }
        } else if (primary.contains(",")) {
            String[] parts = primary.split(",", 3);
            degree = parts[0].trim();
            if (parts.length >= 2) {
                school = parts[1].trim();
            }
            if (parts.length >= 3) {
                year = extractYear(parts[2]);
            }
        } else {
            if (DEGREE_HINT.matcher(primary).find()) {
                degree = primary;
            } else {
                school = primary;
            }
        }

        for (int i = 1; i < lines.length; i++) {
            String line = lines[i].strip();
            if (line.isBlank()) {
                continue;
            }
            if (year.isBlank()) {
                year = extractYear(line);
            }
            if (school.isBlank() && !DEGREE_HINT.matcher(line).find()) {
                school = line.replaceAll("[|]", " ").trim();
            } else if (degree.isBlank() && DEGREE_HINT.matcher(line).find()) {
                degree = line.trim();
            } else if (field.isBlank() && line.toLowerCase(Locale.ROOT).contains(" in ")) {
                field = line.replaceFirst("(?i)^.*\\bin\\b\\s*", "").trim();
            }
        }

        if (year.isBlank()) {
            year = extractYear(block);
        }
        if (degree.isBlank() && !school.isBlank() && DEGREE_HINT.matcher(school).find()) {
            degree = school;
            school = "";
        }
        field = inferFieldOfStudy(degree, field);

        return new ParsedEducation(degree, school, field, year);
    }

    private static String inferFieldOfStudy(String degree, String existing) {
        if (!existing.isBlank()) {
            return existing;
        }
        if (degree == null || degree.isBlank()) {
            return "";
        }
        Matcher m = Pattern.compile("(?i)(?:in|of)\\s+(.+)$").matcher(degree);
        if (m.find()) {
            return m.group(1).trim();
        }
        return "";
    }

    private static String extractYear(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        Matcher range = YEAR_RANGE.matcher(text);
        if (range.find()) {
            String end = range.group(2);
            if (end != null && !end.matches("(?i)present|current")) {
                return end;
            }
            return range.group(1);
        }
        Matcher trailing = TRAILING_YEAR.matcher(text.trim());
        if (trailing.find()) {
            return trailing.group().trim();
        }
        Matcher any = Pattern.compile("\\b(19|20)\\d{2}\\b").matcher(text);
        String last = "";
        while (any.find()) {
            last = any.group();
        }
        return last;
    }

    private static boolean hasContent(ParsedEducation e) {
        return !e.degree().isBlank() || !e.schoolName().isBlank();
    }
}
