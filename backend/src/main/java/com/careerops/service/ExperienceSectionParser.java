package com.careerops.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Splits plain-text / markdown experience sections into one block per role and parses headers.
 */
final class ExperienceSectionParser {

    private static final Pattern BULLET_LINE = Pattern.compile("^[•\\-*▪►#]\\s*");

    private static final String MONTH =
        "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|"
            + "Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";

    /** Title line contains e.g. "Sept 2024 – Present" or "Aug 2021 – Jan 2024". */
    private static final Pattern ROLE_HEADER_DATES = Pattern.compile(
        "\\b(?:" + MONTH + ")\\.?\\s+\\d{4}\\s*[–—\\-]\\s*(?:Present|(?:" + MONTH + ")\\.?\\s+\\d{4}|\\d{4})"
            + "|\\b\\d{4}\\s*[–—\\-]\\s*(?:Present|\\d{4})",
        Pattern.CASE_INSENSITIVE);

    private static final Pattern TRAILING_MONTH_RANGE = Pattern.compile(
        "\\s+((?:" + MONTH + ")\\.?\\s+\\d{4}\\s*[–—\\-]\\s*(?:Present|(?:" + MONTH + ")\\.?\\s+\\d{4}|\\d{4}))\\s*$",
        Pattern.CASE_INSENSITIVE);

    private static final Pattern TRAILING_YEAR_RANGE = Pattern.compile(
        "\\s+(\\d{4}\\s*[–—\\-]\\s*(?:Present|\\d{4}))\\s*$");

    private ExperienceSectionParser() {}

    static List<String> splitIntoRoleBlocks(String body) {
        if (body == null || body.isBlank()) {
            return List.of();
        }
        String[] lines = body.split("\\r?\\n");
        List<String> blocks = new ArrayList<>();
        List<String> current = new ArrayList<>();

        for (String raw : lines) {
            String t = raw.strip();
            if (t.isBlank()) {
                continue;
            }
            if (isRoleHeaderLine(t) && !current.isEmpty()) {
                blocks.add(String.join("\n", current).trim());
                current = new ArrayList<>();
            }
            current.add(t);
        }
        if (!current.isEmpty()) {
            blocks.add(String.join("\n", current).trim());
        }

        if (blocks.size() > 1) {
            return blocks;
        }

        // Legacy: roles separated by blank lines only
        List<String> paragraphBlocks = new ArrayList<>();
        for (String block : body.split("\\n\\n+")) {
            String trimmed = block.trim();
            if (!trimmed.isBlank()) {
                paragraphBlocks.add(trimmed);
            }
        }
        return paragraphBlocks.size() > 1 ? paragraphBlocks : blocks;
    }

    static boolean isRoleHeaderLine(String line) {
        String t = line.strip().replaceFirst("^#+\\s*", "");
        if (t.isBlank() || isBulletLine(t)) {
            return false;
        }
        String lower = t.toLowerCase(Locale.ROOT);
        if (lower.startsWith("challenge")
            || lower.startsWith("action")
            || lower.startsWith("result")
            || lower.startsWith("key achievements")) {
            return false;
        }
        return ROLE_HEADER_DATES.matcher(t).find();
    }

    static boolean isBulletLine(String line) {
        String t = line.strip();
        if (BULLET_LINE.matcher(t).find()) {
            return true;
        }
        String lower = t.toLowerCase(Locale.ROOT);
        return lower.startsWith("challenge")
            || lower.startsWith("action")
            || lower.startsWith("result")
            || lower.startsWith("key achievements");
    }

    /** True when text looks like role blocks (dates and/or achievement bullets), not a prose summary. */
    static boolean hasRoleStructure(String body) {
        if (body == null || body.isBlank()) {
            return false;
        }
        int roleHeaders = 0;
        int bullets = 0;
        for (String raw : body.split("\\r?\\n")) {
            String t = raw.strip();
            if (t.isBlank()) {
                continue;
            }
            if (isRoleHeaderLine(t)) {
                roleHeaders++;
            }
            if (isBulletLine(t)) {
                bullets++;
            }
        }
        return roleHeaders >= 1 || bullets >= 2;
    }

    /**
     * AI sometimes replaces experience with a second professional summary.
     * Repair when the original CV had roles but the rewrite collapsed to prose.
     */
    static boolean needsRepair(String original, String rewritten) {
        if (original == null || original.isBlank()) {
            return false;
        }
        if (!hasRoleStructure(original)) {
            return false;
        }
        if (rewritten == null || rewritten.isBlank()) {
            return true;
        }
        return !hasRoleStructure(rewritten);
    }

    private static final Pattern PAREN_LOCATION = Pattern.compile("\\(([^)]+)\\)\\s*$");

    record ParsedRole(String title, String dates, String company, String location, List<String> bullets) {}

    static ParsedRole parseRoleBlock(String block) {
        String[] lines = block.split("\\r?\\n");
        String titleLine = lines[0].strip().replaceFirst("^#+\\s*", "");
        String title = titleLine;
        String dates = "";
        String company = "";
        String location = "";

        Matcher monthDates = TRAILING_MONTH_RANGE.matcher(titleLine);
        if (monthDates.find()) {
            dates = monthDates.group(1).trim();
            title = titleLine.substring(0, monthDates.start()).trim();
        } else {
            Matcher yearDates = TRAILING_YEAR_RANGE.matcher(titleLine);
            if (yearDates.find()) {
                dates = yearDates.group(1).trim();
                title = titleLine.substring(0, yearDates.start()).trim();
            }
        }

        if (title.contains(" — ")) {
            String[] parts = title.split(" — ", 2);
            title = parts[0].trim();
            if (company.isBlank() && parts.length > 1) {
                company = parts[1].trim();
            }
        }

        location = extractLocation(company);
        if (!location.isBlank()) {
            company = stripLocationSuffix(company);
        }

        List<String> bullets = new ArrayList<>();
        for (int i = 1; i < lines.length; i++) {
            String line = lines[i].strip();
            if (line.isBlank()) {
                continue;
            }
            if (line.matches("^\\*?\\d{4}.*") || line.matches("^\\(.*\\d{4}.*\\)$")) {
                if (dates.isBlank()) {
                    dates = line.replaceAll("^\\*|\\*$", "").trim();
                }
                continue;
            }
            if (isBulletLine(line)) {
                bullets.add(normalizeBullet(line));
            } else if (location.isBlank() && looksLikeLocation(line)) {
                location = line;
            } else if (company.isBlank()
                    && !line.toLowerCase(Locale.ROOT).startsWith("challenge")
                    && !line.toLowerCase(Locale.ROOT).startsWith("action")
                    && !line.toLowerCase(Locale.ROOT).startsWith("key achievements")) {
                company = line;
                String loc = extractLocation(company);
                if (!loc.isBlank()) {
                    location = loc;
                    company = stripLocationSuffix(company);
                }
            } else {
                bullets.add(normalizeBullet(line));
            }
        }

        String[] finalized = finalizeCompanyLocation(company, location);
        company = finalized[0];
        location = finalized[1];

        return new ParsedRole(title, dates, company, location, bullets);
    }

    private static String[] finalizeCompanyLocation(String company, String location) {
        String comp = company != null ? company.trim() : "";
        String loc = location != null ? location.trim() : "";

        if (!comp.isBlank()) {
            CvPipeFields.TwoPart split = CvPipeFields.splitCompanyLocation(comp);
            comp = split.left();
            if (loc.isBlank()) {
                loc = split.right();
            }
        }
        if (comp.isBlank() && loc.contains("|")) {
            CvPipeFields.TwoPart split = CvPipeFields.splitCompanyLocation(loc);
            comp = split.left();
            loc = split.right();
        }
        return new String[] { comp, loc };
    }

    private static boolean looksLikeLocation(String line) {
        String t = line.strip();
        if (t.isBlank() || t.length() > 60) {
            return false;
        }
        String lower = t.toLowerCase(Locale.ROOT);
        if (lower.equals("remote") || lower.equals("hybrid") || lower.contains("ireland")
            || lower.contains("dublin") || lower.contains("london") || lower.contains("uk")) {
            return true;
        }
        return t.matches("^[A-Z][a-zA-Z .,'-]{1,48}$") && !ROLE_HEADER_DATES.matcher(t).find();
    }

    private static String extractLocation(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        Matcher paren = PAREN_LOCATION.matcher(text);
        if (paren.find()) {
            return paren.group(1).trim();
        }
        return "";
    }

    private static String stripLocationSuffix(String text) {
        if (text == null) {
            return "";
        }
        Matcher paren = PAREN_LOCATION.matcher(text);
        if (paren.find()) {
            return text.substring(0, paren.start()).trim();
        }
        return text;
    }

    private static String normalizeBullet(String line) {
        return line.replaceFirst("^[\\s•\\-*▪►#]+\\s*", "").trim();
    }
}
