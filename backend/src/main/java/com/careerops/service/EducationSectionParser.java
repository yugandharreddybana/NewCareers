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
        "(?i)\\b(B\\.?\\s*Tech\\.?|B\\.?E\\.?|B\\.?S\\.?c?\\.?|B\\.?A\\.?|M\\.?S\\.?c?\\.?|M\\.?Tech\\.?|"
            + "M\\.?A\\.?|M\\.?B\\.?A\\.?|Ph\\.?D\\.?|Bachelor|Master|Doctor|Diploma|Certificate|"
            + "B\\.?Eng\\.?|M\\.?Eng\\.?|Associate|HND|LLB|PGDip|PG Dip)\\b"
    );

    private static final Pattern PAREN_LOCATION = Pattern.compile("\\(([^)]+)\\)\\s*$");

    private static final Pattern TRAILING_DASH_LOCATION = Pattern.compile(
        "\\s+[—–-]\\s+([A-Za-z][A-Za-z .,'-]{1,48})\\s*$"
    );

    private static final Pattern INSTITUTION_HINT = Pattern.compile(
        "(?i)\\b(University|College|Institute|School|Academy|Polytechnic|IIT|NIT|TU\\b|UCD|Trinity)"
    );

    private static final Pattern RELATED_COURSES = Pattern.compile(
        "(?i)^(related|relevant)\\s+courses\\b"
    );

    private static final Pattern YEAR_IN_LINE = Pattern.compile("\\b(19|20)\\d{2}\\b");

    private EducationSectionParser() {}

    record ParsedEducation(
        String degree,
        String schoolName,
        String fieldOfStudy,
        String graduationYear,
        String location
    ) {}

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
        boolean inCourseList = false;
        for (String raw : body.split("\\r?\\n")) {
            String line = raw.strip();
            if (line.isBlank()) {
                inCourseList = false;
                if (!current.isEmpty()) {
                    blocks.add(String.join("\n", current).trim());
                    current = new ArrayList<>();
                }
                continue;
            }
            String stripped = line.replaceFirst("^[•\\-*▪►#]+\\s*", "").trim();
            if (RELATED_COURSES.matcher(stripped).find()) {
                inCourseList = true;
                current.add(stripped);
                continue;
            }
            if (inCourseList) {
                current.add(stripped);
                continue;
            }
            if (!current.isEmpty() && looksLikeNewEducationEntry(stripped)) {
                blocks.add(String.join("\n", current).trim());
                current = new ArrayList<>();
            }
            current.add(stripped);
        }
        if (!current.isEmpty()) {
            blocks.add(String.join("\n", current).trim());
        }
        if (blocks.size() <= 1 && body.contains("|")) {
            return splitPipeLines(body);
        }
        return blocks.isEmpty() ? List.of(body.trim()) : blocks;
    }

    private static boolean looksLikeNewEducationEntry(String line) {
        if (line.isBlank()) {
            return false;
        }
        if (RELATED_COURSES.matcher(line).find()) {
            return false;
        }
        if (DEGREE_HINT.matcher(line).find()) {
            return true;
        }
        if (YEAR_IN_LINE.matcher(line).find() && INSTITUTION_HINT.matcher(line).find()) {
            return true;
        }
        if (INSTITUTION_HINT.matcher(line).find() && !BULLET_LINE.matcher(line).find()) {
            return true;
        }
        return line.contains("|") && (DEGREE_HINT.matcher(line).find() || INSTITUTION_HINT.matcher(line).find());
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
        String location = "";

        String primary = lines[0].strip();
        location = extractLocation(primary);
        primary = stripLocationSuffix(primary);

        if (primary.contains("|")) {
            String[] parts = primary.split("\\|");
            CvPipeFields.EducationPipeParts pipe = CvPipeFields.parseEducationPipeParts(parts);
            degree = pipe.degree();
            school = pipe.school();
            year = CvPipeFields.extractYearFromSegment(pipe.yearOrLocation());
            if (year.isBlank() && !pipe.yearOrLocation().isBlank()
                && !CvPipeFields.looksLikeLocationSegment(pipe.yearOrLocation())) {
                location = location.isBlank() ? pipe.yearOrLocation().trim() : location;
            } else if (year.isBlank() && CvPipeFields.looksLikeLocationSegment(pipe.yearOrLocation())) {
                location = location.isBlank() ? pipe.yearOrLocation().trim() : location;
            }
        } else if (primary.contains(",")) {
            String[] parts = primary.split(",", 3);
            boolean firstIsDegree = DEGREE_HINT.matcher(parts[0]).find();
            boolean secondIsDegree = parts.length >= 2 && DEGREE_HINT.matcher(parts[1]).find();
            if (!firstIsDegree && secondIsDegree) {
                school = parts[0].trim();
                degree = parts[1].trim();
                if (parts.length >= 3) {
                    String third = parts[2].trim();
                    year = extractYear(third);
                    if (year.isBlank() && !third.isBlank()) {
                        location = location.isBlank() ? third : location;
                    }
                }
            } else {
                degree = parts[0].trim();
                if (parts.length >= 2) {
                    school = parts[1].trim();
                }
                if (parts.length >= 3) {
                    String third = parts[2].trim();
                    year = extractYear(third);
                    if (year.isBlank() && !third.isBlank()) {
                        location = location.isBlank() ? third : location;
                    }
                }
            }
        } else {
            if (DEGREE_HINT.matcher(primary).find()) {
                degree = primary;
            } else {
                school = primary;
            }
        }

        List<String> courseNames = new ArrayList<>();
        for (int i = 1; i < lines.length; i++) {
            String line = lines[i].strip().replaceFirst("^[•\\-*▪►#]+\\s*", "").trim();
            if (line.isBlank()) {
                continue;
            }
            if (RELATED_COURSES.matcher(line).find()) {
                continue;
            }
            if (location.isBlank()) {
                location = extractLocation(line);
                line = stripLocationSuffix(line);
            }
            if (year.isBlank()) {
                year = extractYear(line);
            }
            if (school.isBlank() && INSTITUTION_HINT.matcher(line).find()) {
                school = line.replaceAll("[|]", " ").trim();
            } else if (school.isBlank() && !DEGREE_HINT.matcher(line).find() && !YEAR_IN_LINE.matcher(line).find()
                && !RELATED_COURSES.matcher(line).find() && !looksLikeCourseNoise(line, degree, school)) {
                school = line.replaceAll("[|]", " ").trim();
            } else if (degree.isBlank() && DEGREE_HINT.matcher(line).find()) {
                degree = line.trim();
            } else if (field.isBlank() && line.toLowerCase(Locale.ROOT).contains(" in ")) {
                field = line.replaceFirst("(?i)^.*\\bin\\b\\s*", "").trim();
            } else if (!DEGREE_HINT.matcher(line).find() && !INSTITUTION_HINT.matcher(line).find()
                && !YEAR_IN_LINE.matcher(line).find() && line.length() < 80
                && !looksLikeCourseNoise(line, degree, school)) {
                courseNames.add(line);
            }
        }
        if (!courseNames.isEmpty() && field.isBlank()) {
            field = String.join(", ", courseNames);
        }

        if (year.isBlank()) {
            year = extractYear(block);
        }
        if (degree.isBlank() && !school.isBlank() && DEGREE_HINT.matcher(school).find()) {
            degree = school;
            school = "";
        }
        field = inferFieldOfStudy(degree, field);

        return new ParsedEducation(degree, school, field, year, location);
    }

    private static String extractLocation(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        Matcher paren = PAREN_LOCATION.matcher(text);
        if (paren.find()) {
            String inner = paren.group(1).trim();
            if (!inner.matches("(?i).*(remote|present|current).*") && !inner.matches(".*\\d{4}.*")) {
                return inner;
            }
        }
        Matcher dash = TRAILING_DASH_LOCATION.matcher(text);
        if (dash.find()) {
            String place = dash.group(1).trim();
            if (!place.matches(".*\\d{4}.*")) {
                return place;
            }
        }
        return "";
    }

    private static String stripLocationSuffix(String text) {
        if (text == null) {
            return "";
        }
        String out = text;
        Matcher paren = PAREN_LOCATION.matcher(out);
        if (paren.find()) {
            String inner = paren.group(1).trim();
            if (!inner.matches(".*\\d{4}.*")) {
                out = out.substring(0, paren.start()).trim();
            }
        }
        Matcher dash = TRAILING_DASH_LOCATION.matcher(out);
        if (dash.find() && !dash.group(1).matches(".*\\d{4}.*")) {
            out = out.substring(0, dash.start()).trim();
        }
        return out;
    }

    private static String inferFieldOfStudy(String degree, String existing) {
        if (!existing.isBlank()) {
            return existing;
        }
        if (degree == null || degree.isBlank()) {
            return "";
        }
        Matcher inMatcher = Pattern.compile("(?i)(?:in|of)\\s+(.+)$").matcher(degree);
        if (inMatcher.find()) {
            return inMatcher.group(1).trim();
        }
        Matcher stripped = Pattern.compile(
            "(?i)^(?:B\\.?\\s*Tech\\.?|B\\.?E\\.?|B\\.?S\\.?c?\\.?|B\\.?A\\.?|M\\.?S\\.?c?\\.?|M\\.?Tech\\.?|"
                + "M\\.?A\\.?|M\\.?B\\.?A\\.?|Ph\\.?D\\.?|Bachelor(?:'s)?|Master(?:'s)?|Doctor(?:ate)?)"
                + "\\s+(?:in\\s+)?(.+)$"
        ).matcher(degree.trim());
        if (stripped.find()) {
            return stripped.group(1).trim();
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

    private static boolean looksLikeCourseNoise(String line, String degree, String school) {
        if (line.isBlank()) {
            return true;
        }
        if (RELATED_COURSES.matcher(line).find()) {
            return true;
        }
        if (!degree.isBlank() && !school.isBlank() && line.length() < 40 && !line.contains(" ")
            && !INSTITUTION_HINT.matcher(line).find()) {
            return true;
        }
        return false;
    }

    private static boolean hasContent(ParsedEducation e) {
        if (e.degree().isBlank() && e.schoolName().isBlank()) {
            return false;
        }
        if (RELATED_COURSES.matcher(e.schoolName()).find() || RELATED_COURSES.matcher(e.degree()).find()) {
            return false;
        }
        boolean hasDegree = DEGREE_HINT.matcher(e.degree()).find();
        boolean hasInstitution = INSTITUTION_HINT.matcher(e.schoolName()).find();
        boolean hasYear = !e.graduationYear().isBlank();
        boolean hasSchool = !e.schoolName().isBlank();

        if (hasDegree && (hasYear || hasSchool || hasInstitution)) {
            return true;
        }
        if (hasInstitution && (hasDegree || hasYear || hasSchool)) {
            return true;
        }
        if (hasSchool && hasYear) {
            return true;
        }
        if (!hasDegree && !hasInstitution && !hasYear) {
            return false;
        }
        return hasDegree || hasInstitution;
    }
}
