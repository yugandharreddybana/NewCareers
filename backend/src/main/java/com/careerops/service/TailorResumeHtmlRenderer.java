package com.careerops.service;



import com.careerops.model.Job;

import com.careerops.model.User;

import com.careerops.model.UserProfile;

import com.fasterxml.jackson.databind.JsonNode;

import org.springframework.core.io.ClassPathResource;

import org.springframework.stereotype.Component;



import java.io.IOException;

import java.nio.charset.StandardCharsets;

import java.util.ArrayList;

import java.util.List;

import java.util.Locale;

import java.util.regex.Pattern;



/**

 * Renders tailored CV content using resume-template.html (ATS-safe styling).

 * Every section from resume.md / sections[] appears in order — nothing dropped.

 */

@Component

public class TailorResumeHtmlRenderer {



    private static final Pattern CATEGORY_LINE = Pattern.compile(

        "^\\s*([A-Za-z][A-Za-z &/\\-]{0,32}):\\s*(.+)$");



    private static final Pattern SKILL_CATEGORY_SPLIT = Pattern.compile(

        "(?=(?i)(?:technical skills|soft skills|frontend|backend|tools|languages)\\s*:)");



    private final String template;



    public TailorResumeHtmlRenderer() throws IOException {

        this.template = new ClassPathResource("career-ops-skills/references/resume-template.html")

            .getContentAsString(StandardCharsets.UTF_8);

    }



    /** Backward-compatible entry when User/Job context is unavailable. */

    public String render(UserProfile profile, String summary, JsonNode sections) {

        return render(null, profile, null, null, summary, sections);

    }



    /**

     * Builds HTML from all tailored sections (one block per resume.md section).

     */

    public String render(

            User user,

            UserProfile profile,

            Job job,

            String persistedJobTitle,

            String summary,

            JsonNode sections) {

        String headerSectionText = extractHeaderSectionText(sections);

        CvHeaderParser.HeaderData headerData = CvHeaderParser.parse(headerSectionText, user, profile);



        String name = CvHeaderParser.resolveName(user, headerData);

        String jobTitle = job != null && job.getTitle() != null && !job.getTitle().isBlank()

            ? job.getTitle().trim()

            : (persistedJobTitle != null ? persistedJobTitle.trim() : "");

        String contactLine = CvHeaderParser.resolveContactLine(jobTitle, profile);

        String headerPreamble = CvHeaderParser.buildPreambleHtml(headerData);

        String pageSize = pageSizeFor(profile);



        StringBuilder body = new StringBuilder();

        boolean summaryRendered = false;



        if (sections != null && sections.isArray()) {

            for (JsonNode row : sections) {

                String nameSec = row.path("name").asText("").trim();

                if (nameSec.isBlank()) continue;

                String lower = nameSec.toLowerCase(Locale.ROOT);

                String rewritten = rewrittenText(row);



                if (lower.equals("header") || lower.equals("contact")) {

                    continue;

                }



                if (lower.equals("cv") || lower.equals("resume")) {

                    continue;

                }



                if (isSummarySection(lower)) {

                    String text = !isBlank(summary) ? summary.trim() : rewritten;

                    if (!text.isBlank()) {

                        body.append(sectionHeading(nameSec));

                        body.append("<div class=\"summary section-content\">")

                            .append(textToSummaryHtml(text)).append("</div></section>");

                        summaryRendered = true;

                    }

                    continue;

                }



                if (rewritten.isBlank()) continue;



                body.append(sectionHeading(nameSec));

                body.append("<div class=\"section-body section-content\">");

                body.append(formatSectionContent(nameSec, rewritten));

                body.append("</div></section>");

            }

        }



        if (!summaryRendered && !isBlank(summary)) {

            body.insert(0,

                sectionHeading("Professional Summary")

                    + "<div class=\"summary section-content\">"

                    + textToSummaryHtml(summary.trim()) + "</div></section>");

        }



        if (body.isEmpty() && !isBlank(summary)) {

            body.append(sectionHeading("Professional Summary"));

            body.append("<div class=\"summary section-content\">")

                .append(textToSummaryHtml(summary.trim())).append("</div></section>");

        }



        return template

            .replace("{{PAGE_SIZE}}", pageSize)

            .replace("{{NAME}}", escape(name))

            .replace("{{CONTACT_LINE}}", escape(contactLine))

            .replace("{{HEADER_PREAMBLE}}", headerPreamble)

            .replace("{{SECTIONS_BODY}}", body.toString());

    }



    public String sectionsToMarkdown(JsonNode sections, String summary) {

        StringBuilder md = new StringBuilder();

        if (!isBlank(summary)) {

            md.append("## Professional Summary\n\n").append(summary.trim()).append("\n\n");

        }

        if (sections == null || !sections.isArray()) {

            return md.toString().trim();

        }

        for (JsonNode row : sections) {

            String name = row.path("name").asText("Section");

            String lower = name.toLowerCase(Locale.ROOT);

            if (lower.equals("header") || lower.equals("contact")) continue;

            if (lower.equals("cv") || lower.equals("resume")) continue;

            String rewritten = rewrittenText(row);

            if (rewritten.isBlank()) continue;

            if (isSummarySection(lower) && !isBlank(summary)) continue;

            md.append("## ").append(name).append("\n\n").append(rewritten.trim()).append("\n\n");

        }

        return md.toString().trim();

    }



    private static String extractHeaderSectionText(JsonNode sections) {

        if (sections == null || !sections.isArray()) {

            return "";

        }

        for (JsonNode row : sections) {

            String name = row.path("name").asText("").trim().toLowerCase(Locale.ROOT);

            if (name.equals("header") || name.equals("contact")) {

                String original = row.path("original").asText("").trim();

                if (!original.isBlank()) {

                    return original;

                }

                return rewrittenText(row);

            }

        }

        return "";

    }



    private String formatSectionContent(String sectionName, String body) {

        String lower = sectionName.toLowerCase(Locale.ROOT);

        if (lower.contains("experience") || lower.contains("employment")) {

            return buildExperienceHtmlFromBody(body);

        }

        if (lower.contains("skill")) {

            return buildSkillsHtmlFromBody(body);

        }

        if (lower.contains("education") || lower.contains("certification")) {

            return bodyToEducationHtml(body);

        }

        return bodyToHtmlBlock(body);

    }



    private static String rewrittenText(JsonNode row) {

        return row.path("rewritten").asText("").trim();

    }



    private static boolean isSummarySection(String lowerName) {

        return lowerName.contains("summary") || lowerName.equals("profile");

    }



    private static String sectionHeading(String name) {

        return "<section class=\"section\"><h2>" + escape(displayHeading(name)) + "</h2>";

    }



    private String buildExperienceHtmlFromBody(String body) {

        if (body.isBlank()) return "";

        StringBuilder html = new StringBuilder();

        for (String block : ExperienceSectionParser.splitIntoRoleBlocks(body)) {

            if (block.isBlank()) continue;

            html.append(formatExperienceEntry(ExperienceSectionParser.parseRoleBlock(block)));

        }

        if (!html.isEmpty()) {

            return html.toString();

        }

        return "<div class=\"experience-fallback\">" + bodyToHtmlBlock(body) + "</div>";

    }



    private String formatExperienceEntry(ExperienceSectionParser.ParsedRole role) {

        StringBuilder entry = new StringBuilder("<div class=\"entry experience-entry\">");

        entry.append("<div class=\"entry-header experience-header\">");

        entry.append("<span class=\"entry-title experience-title\">").append(escape(role.title())).append("</span>");

        if (!role.dates().isBlank()) {

            entry.append("<span class=\"entry-dates experience-dates\">").append(escape(role.dates())).append("</span>");

        }

        entry.append("</div>");

        if (!role.company().isBlank()) {

            entry.append("<div class=\"entry-subline experience-company\">")

                .append(escape(role.company())).append("</div>");

        }

        if (!role.bullets().isEmpty()) {

            entry.append("<ul class=\"experience-bullets\">");

            for (String bullet : role.bullets()) {

                entry.append("<li>").append(escape(normalizeBulletText(bullet))).append("</li>");

            }

            entry.append("</ul>");

        }

        entry.append("</div>");

        return entry.toString();

    }



    private static String buildSkillsHtmlFromBody(String body) {

        if (body.isBlank()) return "";

        StringBuilder html = new StringBuilder("<div class=\"skills-grid\">");

        boolean anyCategory = false;

        for (String line : expandSkillLines(body)) {

            String t = line.trim();

            if (t.isBlank()) continue;

            var cat = CATEGORY_LINE.matcher(t);

            if (cat.matches()) {

                anyCategory = true;

                html.append("<p class=\"skill-line skills-category\"><strong>")

                    .append(escape(cat.group(1))).append(":</strong> ")

                    .append(escape(cat.group(2).trim()))

                    .append("</p>");

            }

        }

        if (!anyCategory) {

            for (String line : body.split("\\r?\\n")) {

                String t = line.trim();

                if (t.isBlank()) continue;

                html.append("<p class=\"skill-line\">").append(escape(t)).append("</p>");

            }

        }

        html.append("</div>");

        return html.toString();

    }



    private static List<String> expandSkillLines(String body) {

        List<String> lines = new ArrayList<>();

        for (String rawLine : body.split("\\r?\\n")) {

            String t = rawLine.trim();

            if (t.isBlank()) continue;

            if (t.toLowerCase(Locale.ROOT).contains("technical skills")

                && t.toLowerCase(Locale.ROOT).contains("soft skills")) {

                String[] parts = SKILL_CATEGORY_SPLIT.split(t);

                for (String part : parts) {

                    if (!part.isBlank()) {

                        lines.add(part.trim());

                    }

                }

            } else if (t.contains(" · ")) {

                for (String seg : t.split("\\s·\\s")) {

                    if (!seg.isBlank()) {

                        lines.add(seg.trim());

                    }

                }

            } else {

                lines.add(t);

            }

        }

        return lines;

    }



    private static String bodyToEducationHtml(String body) {

        if (body == null || body.isBlank()) return "";

        StringBuilder sb = new StringBuilder();

        for (String line : body.split("\\r?\\n")) {

            String t = line.trim();

            if (t.isBlank()) continue;

            if (isBulletLine(t)) {

                sb.append("<div class=\"edu-entry\">")

                    .append(escape(normalizeBulletText(t)))

                    .append("</div>");

            } else {

                sb.append("<div class=\"edu-entry\"><span class=\"degree\">")

                    .append(escape(t))

                    .append("</span></div>");

            }

        }

        return sb.toString();

    }



    private static String bodyToHtmlBlock(String body) {

        if (body == null || body.isBlank()) return "";

        String trimmed = body.trim();

        if (trimmed.contains("\n")) {

            boolean hasBullets = false;

            for (String line : trimmed.split("\\r?\\n")) {

                if (isBulletLine(line.trim())) {

                    hasBullets = true;

                    break;

                }

            }

            if (hasBullets) {

                return "<ul>" + bulletsToHtml(trimmed) + "</ul>";

            }

            StringBuilder sb = new StringBuilder();

            for (String line : trimmed.split("\\r?\\n")) {

                String t = line.trim();

                if (t.isBlank()) continue;

                sb.append("<p class=\"summary\">").append(escape(t)).append("</p>");

            }

            return sb.toString();

        }

        return "<p class=\"summary\">" + escape(trimmed) + "</p>";

    }



    private static String displayHeading(String name) {

        if (name == null || name.isBlank()) return "Section";

        return name.replaceFirst("^#+\\s*", "").trim();

    }



    private static String bulletsToHtml(String text) {

        StringBuilder sb = new StringBuilder();

        for (String line : text.split("\\r?\\n")) {

            String t = line.trim();

            if (t.isBlank() || !isBulletLine(t)) continue;

            sb.append("<li>").append(escape(normalizeBulletText(t))).append("</li>");

        }

        return sb.toString();

    }



    private static boolean isBulletLine(String t) {

        return t.startsWith("•") || t.startsWith("-") || t.startsWith("*")

            || t.startsWith("▪") || t.startsWith("#");

    }



    static String normalizeBulletText(String line) {

        if (line == null) return "";

        return line.replaceFirst("^[\\s•▪\\-*#]+\\s*", "").trim();

    }



    private static String textToSummaryHtml(String summary) {

        if (summary == null || summary.isBlank()) return "";

        return "<p>" + escape(summary.trim()) + "</p>";

    }



    private static boolean isBlank(String s) {

        return s == null || s.isBlank();

    }



    private static String pageSizeFor(UserProfile profile) {

        if (profile != null && profile.getLocation() != null) {

            String loc = profile.getLocation().toLowerCase(Locale.ROOT);

            if (loc.contains("united states") || loc.contains(", us")

                || loc.endsWith(" usa") || loc.contains("u.s.")) {

                return "letter";

            }

        }

        return "A4";

    }



    private static String escape(String s) {

        if (s == null) return "";

        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");

    }

}


