package com.careerops.service;

import com.careerops.dto.JobEvaluationPdfRequest;
import com.careerops.model.Job;
import com.careerops.model.UserJob;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Builds print-ready HTML for job evaluation PDFs (modal-aligned styling). */
final class JobEvaluationPdfHtml {

    private JobEvaluationPdfHtml() {}

    static String fromUserJob(UserJob uj, Job job) {
        JobEvaluationPdfRequest.EvaluationSectionsDto sections = null;
        JsonNode breakdown = uj.getScoreBreakdown();
        if (breakdown != null && breakdown.has("sections")) {
            JsonNode s = breakdown.get("sections");
            sections = new JobEvaluationPdfRequest.EvaluationSectionsDto(
                text(s, "executiveSummary"),
                text(s, "backgroundMatch"),
                text(s, "positioningStrategy"),
                text(s, "compensationAndMarket"),
                text(s, "tailoringPlan"),
                text(s, "interviewPrep")
            );
        }
        Map<String, Double> dimensionScores = extractDimensionScores(breakdown);

        return build(new JobEvaluationPdfRequest(
            job.getTitle(),
            job.getCompany(),
            job.getLocation(),
            uj.getMatchPercent(),
            uj.getAiScore(),
            uj.getVerdict(),
            uj.getHumanSummary(),
            uj.getMatchedSkills() != null ? List.of(uj.getMatchedSkills()) : List.of(),
            uj.getUnmatchedSkills() != null ? List.of(uj.getUnmatchedSkills()) : List.of(),
            uj.getCvImprovementTips() != null ? List.of(uj.getCvImprovementTips()) : List.of(),
            dimensionScores,
            null,
            null,
            null,
            false,
            null,
            null,
            sections
        ));
    }

    static String fromRequest(JobEvaluationPdfRequest req) {
        return build(req);
    }

    private static String build(JobEvaluationPdfRequest req) {
        StringBuilder html = new StringBuilder();
        html.append("<!DOCTYPE html><html xmlns=\"http://www.w3.org/1999/xhtml\"><head><meta charset=\"UTF-8\"/>");
        html.append("<style>");
        html.append("@page { size: A4; margin: 28px; }");
        html.append("body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#1e293b;line-height:1.55;font-size:11pt;margin:0;}");
        html.append(".header{padding:18px 20px;border-bottom:1px solid #e2e8f0;background:#f0f7ff;}");
        html.append(".kicker{font-size:9pt;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0058be;margin:0 0 6px;}");
        html.append("h1{font-size:18pt;color:#0f172a;margin:0 0 4px;font-weight:700;}");
        html.append(".meta{font-size:10pt;color:#64748b;margin:0;}");
        html.append(".pills{margin-top:12px;}");
        html.append(".pill{display:inline-block;background:#e0f2fe;color:#0369a1;padding:5px 12px;border-radius:999px;font-size:9pt;font-weight:700;margin:0 8px 6px 0;}");
        html.append(".summary{margin:20px 0;padding:12px 16px;border-left:4px solid #0058be;background:#f8fafc;font-size:10.5pt;}");
        html.append(".grid{width:100%;border-collapse:separate;border-spacing:8px;margin:12px 0 20px;}");
        html.append(".score-cell{text-align:center;border:1px solid #e2e8f0;border-radius:8px;padding:10px;background:#f8fafc;}");
        html.append(".score-val{font-size:20pt;font-weight:700;color:#0058be;line-height:1.1;}");
        html.append(".score-lbl{font-size:8pt;font-weight:700;text-transform:uppercase;color:#64748b;margin-top:4px;}");
        html.append(".pillars{width:100%;border-collapse:separate;border-spacing:10px;margin:8px 0 20px;}");
        html.append(".pillar{vertical-align:top;width:33%;border-radius:10px;padding:12px;border:1px solid;}");
        html.append(".pillar-strong{background:#f0fdf4;border-color:#bbf7d0;}");
        html.append(".pillar-improve{background:#fffbeb;border-color:#fde68a;}");
        html.append(".pillar-action{background:#eff6ff;border-color:#bfdbfe;}");
        html.append(".pillar h3{font-size:10pt;margin:0 0 8px;}");
        html.append(".pillar-strong h3{color:#166534;}.pillar-improve h3{color:#92400e;}.pillar-action h3{color:#1e40af;}");
        html.append("ul{margin:6px 0 0;padding-left:16px;} li{margin-bottom:5px;font-size:10pt;}");
        html.append(".pillar p{font-size:10pt;margin:8px 0 0;}");
        html.append(".section{margin:0 0 16px;padding:14px 16px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;}");
        html.append(".section h2{font-size:10pt;color:#0058be;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 8px;border:none;padding:0;}");
        html.append(".section p{margin:0;font-size:10.5pt;}");
        html.append(".full h2{font-size:12pt;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin:24px 0 12px;}");
        html.append(".footer{margin-top:28px;font-size:9pt;color:#94a3b8;line-height:1.45;}");
        html.append(".preview-banner{margin:0 0 14px;padding:10px 14px;background:#fffbeb;border:1px solid #fcd34d;color:#92400e;font-size:9pt;font-weight:700;text-align:center;}");
        html.append(".apply-line{margin:12px 0;font-size:11pt;font-weight:700;color:#0f172a;}");
        html.append(".dim-table{width:100%;border-collapse:collapse;margin:12px 0 20px;font-size:9pt;}");
        html.append(".dim-table th,.dim-table td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left;}");
        html.append(".dim-table th{background:#f1f5f9;text-transform:uppercase;font-size:8pt;}");
        html.append("</style></head><body>");

        if (Boolean.TRUE.equals(req.isPreview()) && req.previewWatermark() != null && !req.previewWatermark().isBlank()) {
            html.append("<p class=\"preview-banner\">").append(esc(req.previewWatermark())).append("</p>");
        }

        html.append("<div class=\"header\">");
        html.append("<p class=\"kicker\">AI Job Evaluation</p>");
        html.append("<h1>").append(esc(req.title())).append("</h1>");
        html.append("<p class=\"meta\">").append(esc(req.company())).append(" · ").append(esc(req.location())).append("</p>");
        html.append("<div class=\"pills\">");
        if (req.matchPercent() != null) {
            html.append("<span class=\"pill\">").append(req.matchPercent()).append("% match</span>");
        }
        if (req.overallScore() != null) {
            html.append("<span class=\"pill\">Score ").append(req.overallScore()).append("/100</span>");
        }
        if (req.verdict() != null && !req.verdict().isBlank()) {
            html.append("<span class=\"pill\">").append(esc(req.verdict())).append("</span>");
        }
        html.append("</div></div>");

        if (req.humanSummary() != null && !req.humanSummary().isBlank()) {
            html.append("<p class=\"summary\">").append(escMultiline(req.humanSummary())).append("</p>");
        }

        if (req.applyScore() != null) {
            html.append("<p class=\"apply-line\">Apply score: ")
                .append(String.format(Locale.ROOT, "%.1f", req.applyScore()))
                .append(" / 5");
            if (req.archetype() != null && !req.archetype().isBlank()) {
                html.append(" · Archetype: ").append(esc(req.archetype()));
            }
            html.append("</p>");
        }

        appendDimensionTable(html, req.dimensions());
        appendDimensionGrid(html, req.dimensionScores());

        html.append("<table class=\"pillars\"><tr>");

        html.append("<td class=\"pillar pillar-strong\">");
        html.append("<h3>What's strong</h3>");
        appendSkillList(html, req.matchedSkills());
        JobEvaluationPdfRequest.EvaluationSectionsDto sections = req.sections();
        if (sections != null && sections.backgroundMatch() != null && !sections.backgroundMatch().isBlank()) {
            html.append("<p>").append(escMultiline(sections.backgroundMatch())).append("</p>");
        }
        html.append("</td>");

        html.append("<td class=\"pillar pillar-improve\">");
        html.append("<h3>Needs improvement</h3>");
        appendSkillList(html, req.unmatchedSkills());
        appendTipList(html, req.cvImprovementTips());
        html.append("</td>");

        html.append("<td class=\"pillar pillar-action\">");
        html.append("<h3>What to do next</h3>");
        if (sections != null) {
            appendActionBlock(html, "Position yourself", sections.positioningStrategy());
            appendActionBlock(html, "Tailor your CV", sections.tailoringPlan());
            appendActionBlock(html, "Prepare for interviews", sections.interviewPrep());
        }
        html.append("</td></tr></table>");

        if (sections != null) {
            html.append("<div class=\"full\">");
            html.append("<h2>Full analysis</h2>");
            appendFullSection(html, "Executive summary", sections.executiveSummary());
            appendFullSection(html, "Background match", sections.backgroundMatch());
            appendFullSection(html, "Positioning strategy", sections.positioningStrategy());
            appendFullSection(html, "Compensation &amp; market", sections.compensationAndMarket());
            appendFullSection(html, "CV tailoring plan", sections.tailoringPlan());
            appendFullSection(html, "Interview preparation", sections.interviewPrep());
            html.append("</div>");
        }

        html.append("<p class=\"footer\">");
        if (req.disclaimer() != null && !req.disclaimer().isBlank()) {
            html.append(escMultiline(req.disclaimer())).append("<br/><br/>");
        }
        html.append("Generated by NewCareers · ").append(java.time.Instant.now()).append("</p>");
        html.append("</body></html>");
        return html.toString();
    }

    private static void appendDimensionTable(StringBuilder html, List<JobEvaluationPdfRequest.DimensionDto> dimensions) {
        if (dimensions == null || dimensions.isEmpty()) return;
        html.append("<table class=\"dim-table\"><thead><tr>")
            .append("<th>Dimension</th><th>Score /5</th><th>Weight</th><th>Reason</th>")
            .append("</tr></thead><tbody>");
        for (JobEvaluationPdfRequest.DimensionDto d : dimensions) {
            if (d == null || d.key() == null) continue;
            html.append("<tr><td>").append(esc(d.label() != null ? d.label() : formatDimensionLabel(d.key())))
                .append("</td><td>")
                .append(d.score() != null ? String.format(Locale.ROOT, "%.1f", d.score()) : "—")
                .append("</td><td>")
                .append(d.weight() != null ? String.format(Locale.ROOT, "%.0f%%", d.weight() * 100) : "—")
                .append("</td><td>")
                .append(d.reason() != null ? escMultiline(d.reason()) : "—")
                .append("</td></tr>");
        }
        html.append("</tbody></table>");
    }

    private static void appendDimensionGrid(StringBuilder html, Map<String, Double> scores) {
        if (scores == null || scores.isEmpty()) return;
        html.append("<table class=\"grid\"><tr>");
        int count = 0;
        for (Map.Entry<String, Double> e : scores.entrySet()) {
            if (count > 0 && count % 3 == 0) {
                html.append("</tr><tr>");
            }
            html.append("<td class=\"score-cell\"><div class=\"score-val\">").append(formatScore(e.getValue()))
                .append("</div><div class=\"score-lbl\">").append(esc(formatDimensionLabel(e.getKey())))
                .append("</div></td>");
            count++;
        }
        html.append("</tr></table>");
    }

    private static String formatScore(Double value) {
        if (value == null) return "—";
        if (Math.rint(value) == value) {
            return String.valueOf(value.intValue());
        }
        return String.format(Locale.ROOT, "%.1f", value);
    }

    private static void appendSkillList(StringBuilder html, List<String> items) {
        if (items == null || items.isEmpty()) return;
        html.append("<ul>");
        for (String item : items) {
            if (item != null && !item.isBlank()) {
                html.append("<li>").append(esc(item)).append("</li>");
            }
        }
        html.append("</ul>");
    }

    private static void appendTipList(StringBuilder html, List<String> tips) {
        if (tips == null || tips.isEmpty()) return;
        html.append("<ul>");
        for (String tip : tips) {
            if (tip != null && !tip.isBlank()) {
                html.append("<li>").append(esc(tip)).append("</li>");
            }
        }
        html.append("</ul>");
    }

    private static void appendActionBlock(StringBuilder html, String label, String text) {
        if (text == null || text.isBlank()) return;
        html.append("<p><strong>").append(esc(label)).append("</strong><br/>")
            .append(escMultiline(text)).append("</p>");
    }

    private static void appendFullSection(StringBuilder html, String title, String text) {
        if (text == null || text.isBlank()) return;
        html.append("<div class=\"section\"><h2>").append(title).append("</h2><p>")
            .append(escMultiline(text)).append("</p></div>");
    }

    private static Map<String, Double> extractDimensionScores(JsonNode breakdown) {
        if (breakdown == null || !breakdown.isObject()) return Map.of();
        java.util.Map<String, Double> scores = new java.util.LinkedHashMap<>();
        Iterator<Map.Entry<String, JsonNode>> fields = breakdown.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> f = fields.next();
            String key = f.getKey();
            if ("sections".equals(key) || "overallScore".equals(key) || "matchPercent".equals(key)
                || "matchedSkills".equals(key) || "unmatchedSkills".equals(key)
                || "cvImprovementTips".equals(key) || "verdict".equals(key) || "humanSummary".equals(key)
                || "sponsorshipMatch".equals(key) || "salaryMatch".equals(key)) {
                continue;
            }
            if (f.getValue().isNumber()) {
                scores.put(key, f.getValue().doubleValue());
            }
        }
        if (breakdown.has("sections") && breakdown.get("sections").isObject()) {
            Iterator<Map.Entry<String, JsonNode>> sub = breakdown.get("sections").fields();
            while (sub.hasNext()) {
                Map.Entry<String, JsonNode> f = sub.next();
                if (f.getValue().isNumber()) {
                    scores.putIfAbsent(f.getKey(), f.getValue().doubleValue());
                }
            }
        }
        return scores;
    }

    private static String text(JsonNode node, String field) {
        if (node == null || !node.has(field)) return null;
        String v = node.get(field).asText(null);
        return (v == null || v.isBlank()) ? null : v;
    }

    private static String formatDimensionLabel(String key) {
        if (key == null || key.isBlank()) return "";
        String[] parts = key.replace('_', ' ').replace('-', ' ').split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String part : parts) {
            if (part.isBlank()) continue;
            if (!sb.isEmpty()) sb.append(' ');
            sb.append(part.substring(0, 1).toUpperCase(Locale.ROOT));
            if (part.length() > 1) {
                sb.append(part.substring(1).toLowerCase(Locale.ROOT));
            }
        }
        return sb.toString();
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static String escMultiline(String s) {
        return esc(s).replace("\n", "<br/>");
    }
}
