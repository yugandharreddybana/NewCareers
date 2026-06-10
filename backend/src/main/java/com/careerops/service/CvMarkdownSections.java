package com.careerops.service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Splits a markdown/plain CV into named sections for tailoring and diff panels.
 */
public final class CvMarkdownSections {

    private static final Pattern HEADING = Pattern.compile(
        "^(#{1,3}\\s+.+|[A-Z][A-Za-z &/\\-]{2,60}:)\\s*$",
        Pattern.MULTILINE);

    /** Plain-text CVs often use ALL CAPS section titles without # or trailing colon. */
    private static final Pattern KNOWN_SECTION_HEADING = Pattern.compile(
        "^\\s*(PROFESSIONAL SUMMARY|PROFILE|SUMMARY|SKILLS|TECHNICAL SKILLS|CORE SKILLS|"
            + "PROFESSIONAL EXPERIENCE|WORK EXPERIENCE|EXPERIENCE|EMPLOYMENT|"
            + "EDUCATION|QUALIFICATIONS|ACADEMIC BACKGROUND|ACADEMIC HISTORY|TRAINING|"
            + "CERTIFICATIONS|PROJECTS|LANGUAGES|REFERENCES|AWARDS|"
            + "VOLUNTEER|INTERESTS)\\s*$",
        Pattern.MULTILINE | Pattern.CASE_INSENSITIVE);

    private static final Map<String, String> NORMALIZE = Map.ofEntries(
        Map.entry("summary", "Professional summary"),
        Map.entry("professional summary", "Professional summary"),
        Map.entry("profile", "Professional summary"),
        Map.entry("experience", "Professional experience"),
        Map.entry("professional experience", "Professional experience"),
        Map.entry("work experience", "Professional experience"),
        Map.entry("employment", "Professional experience"),
        Map.entry("education", "Education"),
        Map.entry("qualifications", "Education"),
        Map.entry("academic background", "Education"),
        Map.entry("academic history", "Education"),
        Map.entry("training", "Education"),
        Map.entry("skills", "Skills"),
        Map.entry("technical skills", "Skills"),
        Map.entry("core skills", "Skills"),
        Map.entry("certifications", "Certifications"),
        Map.entry("projects", "Projects")
    );

    private CvMarkdownSections() {}

    public record Section(String name, String body) {}

    public static List<Section> parse(String cvText) {
        if (cvText == null || cvText.isBlank()) {
            return List.of();
        }
        String text = cvText.replace("\r\n", "\n").trim();
        List<int[]> spans = collectHeadingSpans(text);
        if (spans.isEmpty()) {
            return preambleAsHeaderOnly(text);
        }

        List<Section> sections = new ArrayList<>();
        if (spans.get(0)[0] > 0) {
            String preamble = text.substring(0, spans.get(0)[0]).trim();
            if (!preamble.isBlank()) {
                sections.add(new Section("Header", preamble));
            }
        }
        for (int i = 0; i < spans.size(); i++) {
            int start = spans.get(i)[1];
            int end = i + 1 < spans.size() ? spans.get(i + 1)[0] : text.length();
            String rawTitle = text.substring(spans.get(i)[0], spans.get(i)[1]).trim();
            String name = normalizeTitle(rawTitle);
            String body = text.substring(start, end).trim();
            if (!body.isBlank()) {
                sections.add(new Section(name, body));
            }
        }
        return sections;
    }

    private static List<int[]> collectHeadingSpans(String text) {
        List<int[]> knownSpans = new ArrayList<>();
        Matcher known = KNOWN_SECTION_HEADING.matcher(text);
        while (known.find()) {
            knownSpans.add(new int[] { known.start(), known.end() });
        }
        // Prefer ALL-CAPS CV section titles — generic "Key Achievements:" lines must not
        // shadow PROFESSIONAL EXPERIENCE / EDUCATION / PROJECTS detection.
        if (!knownSpans.isEmpty()) {
            return knownSpans;
        }

        List<int[]> spans = new ArrayList<>();
        Matcher m = HEADING.matcher(text);
        while (m.find()) {
            spans.add(new int[] { m.start(), m.end() });
        }
        return spans;
    }

    /** When no headings exist, expose contact block as Header only — never one giant "CV" section. */
    private static List<Section> preambleAsHeaderOnly(String text) {
        Matcher known = KNOWN_SECTION_HEADING.matcher(text);
        if (known.find()) {
            String preamble = text.substring(0, known.start()).trim();
            List<Section> sections = new ArrayList<>();
            if (!preamble.isBlank()) {
                sections.add(new Section("Header", preamble));
            }
            sections.addAll(parse(text.substring(known.start())));
            return sections;
        }
        if (text.isBlank()) {
            return List.of();
        }
        return List.of(new Section("Header", text));
    }

    private static String normalizeTitle(String raw) {
        String t = raw.replaceAll("^#+\\s*", "").replace(":", "").trim();
        String key = t.toLowerCase(Locale.ROOT);
        return NORMALIZE.getOrDefault(key, t);
    }

    /** Stable key for matching AI section names to parsed CV sections (e.g. "Experience" → "professional experience"). */
    public static String sectionMatchKey(String rawName) {
        if (rawName == null || rawName.isBlank()) {
            return "";
        }
        String display = normalizeTitle(rawName.trim());
        return display.toLowerCase(Locale.ROOT);
    }
}
