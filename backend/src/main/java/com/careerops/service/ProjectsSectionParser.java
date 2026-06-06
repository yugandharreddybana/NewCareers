package com.careerops.service;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Parses a CV projects section into title + description blocks for markdown export.
 */
final class ProjectsSectionParser {

    private static final int MAX_ENTRIES = 15;

    private static final Pattern BULLET_LINE = Pattern.compile("^[•\\-*▪►#]\\s*");

    private ProjectsSectionParser() {}

    record ParsedProject(String title, String description) {}

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
            boolean looksLikeTitle = !BULLET_LINE.matcher(line).find()
                && (stripped.endsWith(":") || (current.isEmpty() && !stripped.startsWith("http")));
            if (looksLikeTitle && !current.isEmpty()) {
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

    private static ParsedProject parseBlock(String block) {
        String[] lines = block.split("\\r?\\n");
        if (lines.length == 0) {
            return new ParsedProject("", "");
        }
        String title = lines[0].strip().replaceAll(":$", "").trim();
        List<String> descLines = new ArrayList<>();
        for (int i = 1; i < lines.length; i++) {
            String line = lines[i].strip().replaceFirst("^[•\\-*▪►#]+\\s*", "").trim();
            if (!line.isBlank()) {
                descLines.add(line);
            }
        }
        return new ParsedProject(title, String.join("\n", descLines).trim());
    }
}
