package com.careerops.service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Parses a CV projects section into title + description + url + location + techTags blocks.
 */
final class ProjectsSectionParser {

    private static final int MAX_ENTRIES = 15;

    private static final Pattern BULLET_LINE = Pattern.compile("^[•\\-*▪►#]\\s*");

    private static final Pattern PAREN_LOCATION = Pattern.compile("\\(([^)]+)\\)\\s*$");

    private static final Pattern GENERIC_HEADER = Pattern.compile(
        "(?i)^(project\\s+details?|description|technologies|tech\\s+stack|built\\s+with|stack)\\s*:?\\s*$"
    );

    private static final Pattern TECH_LABEL_LINE = Pattern.compile(
        "(?i)^(technologies|tech\\s+stack|built\\s+with|stack)\\s*:\\s*(.+)$"
    );

    private ProjectsSectionParser() {}

    record ParsedProject(String title, String description, String url, String location, List<String> techTags) {}

    static List<ParsedProject> parseEntries(String body) {
        if (body == null || body.isBlank()) {
            return List.of();
        }
        List<String> blocks = splitBlocks(body);
        List<ParsedProject> out = new ArrayList<>();
        for (String block : blocks) {
            ParsedProject project = parseBlock(block);
            if (!project.title().isBlank() || !project.description().isBlank()) {
                out.add(project);
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
            String stripped = line.replaceFirst("^#+\\s*", "").replaceFirst("^[•\\-*▪►#]+\\s*", "").trim();
            if (looksLikeNewProjectHeader(stripped, current)) {
                blocks.add(String.join("\n", current).trim());
                current = new ArrayList<>();
            }
            current.add(stripped);
        }
        if (!current.isEmpty()) {
            blocks.add(String.join("\n", current).trim());
        }
        return blocks.isEmpty() ? List.of(body.trim()) : blocks;
    }

    private static boolean looksLikeNewProjectHeader(String stripped, List<String> current) {
        if (current.isEmpty()) {
            return false;
        }
        if (BULLET_LINE.matcher(stripped).find()) {
            return false;
        }
        if (GENERIC_HEADER.matcher(stripped).find()) {
            return false;
        }
        if (stripped.endsWith(":")) {
            return currentLooksLikeProjectStarted(current);
        }
        if (CvPipeFields.looksLikeProjectPipeTitle(stripped)) {
            return currentLooksLikeProjectStarted(current);
        }
        return false;
    }

    private static boolean currentLooksLikeProjectStarted(List<String> current) {
        for (String raw : current) {
            String line = raw.strip().replaceFirst("^#+\\s*", "").replaceFirst("^[â€¢\\-*â–ªâ–º#]+\\s*", "").trim();
            if (line.isBlank() || GENERIC_HEADER.matcher(line).find() || TECH_LABEL_LINE.matcher(line).find()
                || isCommaSeparatedTech(line)) {
                continue;
            }
            if (looksLikeProjectTitle(line)) {
                return true;
            }
        }
        return false;
    }

    private static ParsedProject parseBlock(String block) {
        String[] lines = block.split("\\r?\\n");
        if (lines.length == 0) {
            return new ParsedProject("", "", "", "", List.of());
        }

        List<String> techTags = new ArrayList<>();
        List<String> descLines = new ArrayList<>();
        String titleLine = "";
        String location = "";
        String url = "";

        int startIdx = 0;
        String first = lines[0].strip().replaceAll(":$", "").trim();
        if (GENERIC_HEADER.matcher(first).find() && lines.length > 1) {
            startIdx = 1;
        }

        for (int i = startIdx; i < lines.length; i++) {
            String line = lines[i].strip().replaceFirst("^[•\\-*▪►#]+\\s*", "").trim();
            if (line.isBlank()) {
                continue;
            }

            Matcher techLabel = TECH_LABEL_LINE.matcher(line);
            if (techLabel.find()) {
                techTags.addAll(parseTechTokens(techLabel.group(2)));
                continue;
            }

            if (titleLine.isBlank() && looksLikeProjectTitle(line)) {
                CvPipeFields.ProjectPipeParts parsed = CvPipeFields.splitProjectTitleLink(line);
                titleLine = parsed.title();
                if (url.isBlank() && !parsed.url().isBlank()) {
                    url = parsed.url();
                }
                if (location.isBlank() && !parsed.location().isBlank()) {
                    location = parsed.location();
                }
                continue;
            }

            if (titleLine.isBlank() && isCommaSeparatedTech(line)) {
                techTags.addAll(parseTechTokens(line));
                continue;
            }

            Matcher lineUrl = URL_PATTERN.matcher(line);
            if (url.isBlank() && lineUrl.find()) {
                url = ProjectLinkExtractor.normalizeUrl(lineUrl.group(1));
                line = line.replace(lineUrl.group(1), "").trim();
            }
            if (location.isBlank()) {
                String loc = extractLocation(line);
                if (!loc.isBlank()) {
                    location = loc;
                    line = stripLocationSuffix(line);
                }
            }
            if (!line.isBlank()) {
                descLines.add(line);
            }
        }

        if (titleLine.isBlank() && !descLines.isEmpty()) {
            String candidate = descLines.remove(0);
            if (looksLikeProjectTitle(candidate)) {
                CvPipeFields.ProjectPipeParts parsed = CvPipeFields.splitProjectTitleLink(candidate);
                titleLine = parsed.title();
                if (url.isBlank() && !parsed.url().isBlank()) {
                    url = parsed.url();
                }
                if (location.isBlank() && !parsed.location().isBlank()) {
                    location = parsed.location();
                }
            } else {
                descLines.add(0, candidate);
            }
        }

        String description = String.join("\n", descLines).trim();
        if (url.isBlank()) {
            ProjectLinkExtractor.ResolvedLink resolved = ProjectLinkExtractor.extractAndStrip(block);
            if (!resolved.url().isBlank()) {
                url = resolved.url();
                description = resolved.cleanedText();
            }
        } else if (!description.isBlank()) {
            description = ProjectLinkExtractor.stripUrls(description);
        }

        return new ParsedProject(
            titleLine,
            description,
            url,
            location,
            techTags
        );
    }

    private static final Pattern URL_PATTERN = Pattern.compile(
        "(?i)(https?://[^\\s<>\"']+|(?:www\\.)?github\\.com/[\\w.\\-/%]+|"
            + "(?:www\\.)?gitlab\\.com/[\\w.\\-/%]+|(?:www\\.)?bitbucket\\.org/[\\w.\\-/%]+)"
    );

    private static boolean looksLikeProjectTitle(String line) {
        if (line.isBlank() || GENERIC_HEADER.matcher(line).find()) {
            return false;
        }
        if (TECH_LABEL_LINE.matcher(line).find()) {
            return false;
        }
        if (isCommaSeparatedTech(line) && !line.contains("|")) {
            return false;
        }
        return line.length() <= 120;
    }

    private static boolean isCommaSeparatedTech(String line) {
        if (!line.contains(",")) {
            return false;
        }
        String[] parts = line.split(",");
        if (parts.length < 2) {
            return false;
        }
        int shortParts = 0;
        for (String part : parts) {
            String t = part.trim();
            if (t.length() > 0 && t.length() <= 30) {
                shortParts++;
            }
        }
        return shortParts >= 2;
    }

    private static List<String> parseTechTokens(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        return Arrays.stream(raw.split("[,;|/]"))
            .map(String::trim)
            .filter(s -> !s.isBlank() && !s.equalsIgnoreCase("link"))
            .collect(Collectors.toList());
    }

    private static String extractLocation(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        Matcher paren = PAREN_LOCATION.matcher(text);
        if (paren.find()) {
            String inner = paren.group(1).trim();
            if (!inner.matches("(?i).*(http|github).*")) {
                return inner;
            }
        }
        return "";
    }

    private static String stripLocationSuffix(String text) {
        if (text == null) {
            return "";
        }
        Matcher paren = PAREN_LOCATION.matcher(text);
        if (paren.find()) {
            String inner = paren.group(1).trim();
            if (!inner.matches("(?i).*(http|github).*")) {
                return text.substring(0, paren.start()).trim();
            }
        }
        return text;
    }
}
