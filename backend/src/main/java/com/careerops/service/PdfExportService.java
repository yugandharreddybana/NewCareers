package com.careerops.service;

import com.careerops.model.SkillRun;
import com.careerops.repository.SkillRunRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.util.*;

/**
 * Generates PDF files from skill run outputs.
 *
 * Three PDF types:
 *   1. Single skill    → generateSkillPdf()
 *   2. All 9 skills    → generateAllSkillsPdf()
 *   3. Tailored resume → generateResumePdf() (renders resumeHtml directly)
 *
 * Uses openhtmltopdf (Apache 2.0) + pdfbox 2.x.
 * No external services needed — runs fully local inside the JVM.
 */
@Service
public class PdfExportService {

    private static final Logger log = LoggerFactory.getLogger(PdfExportService.class);

    private static final List<String> ALL_SKILLS = List.of(
        "evaluate", "tailor-resume", "research", "prep-interview",
        "apply", "outreach", "compare", "triage", "scan"
    );

    private final SkillRunRepository skillRuns;
    private final ObjectMapper       mapper;

    public PdfExportService(SkillRunRepository skillRuns, ObjectMapper mapper) {
        this.skillRuns = skillRuns;
        this.mapper    = mapper;
    }

    // ================================================================
    // PUBLIC METHODS
    // ================================================================

    /**
     * Generate a PDF for a single skill.
     * Returns the raw PDF bytes to stream to the client.
     */
    public byte[] generateSkillPdf(UUID userId, UUID userJobId, String skillName) throws Exception {
        Optional<SkillRun> runOpt = skillRuns
                .findFirstByUserIdAndUserJobIdAndSkillOrderByCreatedAtDesc(userId, userJobId, skillName);

        String html = buildPageHtml(
                "CareerOps — " + toTitle(skillName),
                List.of(buildSkillSection(skillName, runOpt.orElse(null)))
        );
        return renderToPdf(html);
    }

    /**
     * Generate a PDF containing all 9 skills, each on its own page.
     */
    public byte[] generateAllSkillsPdf(UUID userId, UUID userJobId) throws Exception {
        List<SkillRun> allRuns = skillRuns.findByUserIdAndUserJobIdOrderByCreatedAtDesc(userId, userJobId);
        // Map skill → most recent run
        Map<String, SkillRun> runBySkill = new LinkedHashMap<>();
        for (SkillRun sr : allRuns) {
            runBySkill.putIfAbsent(sr.getSkill(), sr);
        }

        List<String> sections = new ArrayList<>();
        for (String skill : ALL_SKILLS) {
            sections.add(buildSkillSection(skill, runBySkill.get(skill)));
        }

        String html = buildPageHtml("CareerOps — Complete Career Pack", sections);
        return renderToPdf(html);
    }

    /**
     * Generate a PDF from the stored resume HTML.
     * The HTML is already ATS-formatted by Claude — rendered exactly as-is.
     */
    public byte[] generateResumePdf(UUID userId, UUID userJobId) throws Exception {
        Optional<SkillRun> runOpt = skillRuns
                .findFirstByUserIdAndUserJobIdAndSkillOrderByCreatedAtDesc(userId, userJobId, "tailor-resume");

        if (runOpt.isEmpty() || runOpt.get().getResumeHtml() == null) {
            // Fall back to a placeholder page
            String html = buildPageHtml("Resume Not Available", List.of(
                "<div class='placeholder'><h2>Resume not yet generated</h2>" +
                "<p>Run the <strong>Tailor Resume</strong> skill first to generate your ATS-optimised resume.</p></div>"
            ));
            return renderToPdf(html);
        }

        // Wrap the resume HTML in a minimal PDF-safe page shell
        String resumeHtml = """
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="UTF-8"/>
                  <style>
                    body { font-family: Arial, Helvetica, sans-serif; margin: 2cm; font-size: 10pt; color: #111; }
                    h1   { font-size: 16pt; border-bottom: 1px solid #333; padding-bottom: 4px; }
                    h2   { font-size: 12pt; margin-top: 12px; }
                    table { width: 100%%; border-collapse: collapse; }
                    td, th { padding: 4px 6px; border: 1px solid #ccc; }
                    th { background: #f5f5f5; font-weight: bold; }
                    ul { margin: 4px 0 4px 16px; padding: 0; }
                    li { margin-bottom: 2px; }
                  </style>
                </head>
                <body>
                %s
                </body>
                </html>
                """.formatted(runOpt.get().getResumeHtml());

        return renderToPdf(resumeHtml);
    }

    // ================================================================
    // PRIVATE HELPERS
    // ================================================================

    private String buildSkillSection(String skillName, SkillRun run) {
        StringBuilder sb = new StringBuilder();
        // Page-break before every section except the first
        sb.append("<div class='skill-section' style='page-break-before: always;'>");
        sb.append("<div class='skill-header'>");
        sb.append("<h1>").append(toTitle(skillName)).append("</h1>");
        sb.append("<span class='date'>Generated: ").append(LocalDate.now()).append("</span>");
        sb.append("</div>");

        if (run == null || run.getOutput() == null) {
            sb.append("<div class='placeholder'>");
            sb.append("<p>This skill has not been run yet. ");
            sb.append("Open your job details page and click <strong>").append(toTitle(skillName));
            sb.append("</strong> to generate this section.</p>");
            sb.append("</div>");
        } else {
            sb.append(outputToHtml(skillName, run.getOutput()));
        }

        sb.append("</div>");
        return sb.toString();
    }

    /**
     * Convert a skill's JSON output to readable HTML.
     * Handles both structured JSON objects and plain text strings.
     */
    private String outputToHtml(String skillName, JsonNode output) {
        if (output == null) return "<p>No output available.</p>";

        // If output is a plain text string (Claude returned markdown)
        if (output.isTextual()) {
            String text = output.asText();
            // Convert markdown-ish text to basic HTML
            text = text
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replaceAll("(?m)^### (.+)$", "<h3>$1</h3>")
                .replaceAll("(?m)^## (.+)$",  "<h2>$1</h2>")
                .replaceAll("(?m)^# (.+)$",   "<h2>$1</h2>")
                .replaceAll("\\*\\*(.+?)\\*\\*", "<strong>$1</strong>")
                .replaceAll("(?m)^- (.+)$",    "<li>$1</li>")
                .replaceAll("(<li>.*</li>)",    "<ul>$1</ul>")
                .replace("\n\n", "</p><p>")
                .replace("\n", "<br/>");
            return "<p>" + text + "</p>";
        }

        // If output is a JSON object, render key-value pairs
        if (output.isObject()) {
            StringBuilder sb = new StringBuilder();
            output.fields().forEachRemaining(entry -> {
                sb.append("<h3>").append(toTitle(entry.getKey())).append("</h3>");
                JsonNode val = entry.getValue();
                if (val.isTextual()) {
                    sb.append("<p>").append(val.asText()).append("</p>");
                } else if (val.isArray()) {
                    sb.append("<ul>");
                    val.forEach(item -> sb.append("<li>").append(item.asText()).append("</li>"));
                    sb.append("</ul>");
                } else {
                    sb.append("<pre>").append(val.toString()).append("</pre>");
                }
            });
            return sb.toString();
        }

        return "<pre>" + output.toString() + "</pre>";
    }

    /** Wrap sections in a full PDF-safe HTML document with shared styles. */
    private String buildPageHtml(String title, List<String> sections) {
        return """
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="UTF-8"/>
                  <title>%s</title>
                  <style>
                    @page { size: A4; margin: 1.5cm 2cm; }
                    body  { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #111; line-height: 1.5; }
                    h1    { font-size: 15pt; color: #1a1a2e; border-bottom: 2px solid #4361ee; padding-bottom: 4px; margin-bottom: 8px; }
                    h2    { font-size: 12pt; color: #2d2d2d; margin-top: 14px; }
                    h3    { font-size: 10pt; color: #444; margin-top: 10px; }
                    table { width: 100%%; border-collapse: collapse; margin: 8px 0; }
                    td, th { padding: 5px 8px; border: 1px solid #ddd; vertical-align: top; }
                    th    { background-color: #f0f4ff; font-weight: bold; }
                    ul    { margin: 4px 0 8px 18px; padding: 0; }
                    li    { margin-bottom: 3px; }
                    .skill-header { display: flex; justify-content: space-between; align-items: baseline; }
                    .date { font-size: 8pt; color: #888; }
                    .placeholder { background: #fafafa; border: 1px dashed #ccc; padding: 16px; border-radius: 4px; color: #666; }
                    .skill-section:first-child { page-break-before: avoid !important; }
                  </style>
                </head>
                <body>
                %s
                </body>
                </html>
                """.formatted(title, String.join("\n", sections));
    }

    /** Render HTML string to PDF bytes via openhtmltopdf. */
    private byte[] renderToPdf(String html) throws Exception {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null);
            builder.toStream(baos);
            builder.run();
            return baos.toByteArray();
        }
    }

    private String toTitle(String kebab) {
        if (kebab == null) return "";
        String[] parts = kebab.split("-");
        StringBuilder sb = new StringBuilder();
        for (String part : parts) {
            if (!part.isEmpty()) {
                sb.append(Character.toUpperCase(part.charAt(0)))
                  .append(part.substring(1))
                  .append(" ");
            }
        }
        return sb.toString().trim();
    }
}
