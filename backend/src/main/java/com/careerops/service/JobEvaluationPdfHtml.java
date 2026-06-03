package com.careerops.service;

import com.careerops.dto.JobEvaluationPdfRequest;
import com.careerops.model.Job;
import com.careerops.model.UserJob;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Builds print-ready HTML for job evaluation PDFs (aligned with JobEvaluationModal). */
final class JobEvaluationPdfHtml {

    private JobEvaluationPdfHtml() {}

    static String fromUserJob(UserJob uj, Job job) {
        JsonNode breakdown = uj.getScoreBreakdown();
        JobEvaluationPdfRequest.EvaluationSectionsDto sections = null;
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
        Double applyScore = breakdown != null && breakdown.has("applyScore")
            ? breakdown.path("applyScore").asDouble()
            : null;

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
            extractDimensionScores(breakdown),
            extractDimensionDtos(breakdown),
            applyScore,
            text(breakdown, "archetype"),
            false,
            null,
            null,
            applyGateMessage(applyScore),
            stringList(breakdown, "nextSteps"),
            stringList(breakdown, "storyBankCandidates"),
            boolField(breakdown, "sponsorshipMatch"),
            boolField(breakdown, "salaryMatch"),
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
        html.append("@page { size: A4; margin: 24px; }");
        html.append("body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#1e293b;line-height:1.55;font-size:11pt;margin:0;}");
        html.append(".header{padding:18px 20px;border-bottom:1px solid #e2e8f0;background:#f0f7ff;}");
        html.append(".kicker{font-size:9pt;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0058be;margin:0 0 6px;}");
        html.append("h1{font-size:18pt;color:#0f172a;margin:0 0 4px;font-weight:700;}");
        html.append(".job-subtitle{font-size:10pt;color:#64748b;margin:0;}");
        html.append(".pills{margin-top:12px;}");
        html.append(".pill{display:inline-block;background:#e0f2fe;color:#0369a1;padding:5px 12px;border-radius:999px;font-size:9pt;font-weight:700;margin:0 8px 6px 0;}");
        html.append(".summary{margin:16px 0;padding:12px 16px;border-left:4px solid #0058be;background:#f8fafc;font-size:10.5pt;}");
        html.append(".apply-hero{margin:14px 0;padding:14px 16px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;}");
        html.append(".apply-score{font-size:22pt;font-weight:700;color:#0058be;line-height:1.1;}");
        html.append(".apply-gate{margin-top:8px;padding:8px 12px;border-radius:8px;font-size:10pt;font-weight:600;}");
        html.append(".apply-gate-go{background:#ecfdf5;color:#166534;border:1px solid #bbf7d0;}");
        html.append(".apply-gate-caution{background:#fffbeb;color:#92400e;border:1px solid #fde68a;}");
        html.append(".apply-gate-stop{background:#fff1f2;color:#9f1239;border:1px solid #fecdd3;}");
        html.append(".fit-row{margin:8px 0 16px;font-size:10pt;color:#475569;}");
        html.append(".legend{margin:0 0 16px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:9.5pt;color:#475569;}");
        html.append(".dim-table{width:100%;border-collapse:collapse;margin:12px 0 20px;font-size:9pt;page-break-inside:avoid;}");
        html.append(".dim-table th,.dim-table td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left;vertical-align:top;}");
        html.append(".dim-table th{background:#f1f5f9;text-transform:uppercase;font-size:8pt;}");
        html.append(".pillar-block{margin:0 0 14px;padding:14px 16px;border-radius:10px;border:1px solid;page-break-inside:avoid;}");
        html.append(".pillar-strong{background:#f0fdf4;border-color:#bbf7d0;}");
        html.append(".pillar-improve{background:#fffbeb;border-color:#fde68a;}");
        html.append(".pillar-action{background:#eff6ff;border-color:#bfdbfe;}");
        html.append(".pillar-block h3{font-size:11pt;margin:0 0 10px;}");
        html.append(".pillar-strong h3{color:#166534;}.pillar-improve h3{color:#92400e;}.pillar-action h3{color:#1e40af;}");
        html.append("ul{margin:6px 0 0;padding-left:18px;} li{margin-bottom:6px;font-size:10pt;}");
        html.append(".pillar-block p{font-size:10pt;margin:10px 0 0;}");
        html.append(".section{margin:0 0 14px;padding:14px 16px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;page-break-inside:avoid;}");
        html.append(".section h2{font-size:10pt;color:#0058be;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 8px;}");
        html.append(".section p{margin:0;font-size:10.5pt;white-space:pre-wrap;}");
        html.append(".full-title{font-size:12pt;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin:20px 0 12px;}");
        html.append(".story-block{margin:0 0 16px;padding:14px 16px;border:1px solid #e2e8f0;border-radius:10px;}");
        html.append(".story-block h2{font-size:11pt;margin:0 0 8px;color:#0f172a;}");
        html.append(".footer{margin-top:24px;font-size:9pt;color:#94a3b8;line-height:1.45;}");
        html.append(".preview-banner{margin:0 0 14px;padding:10px 14px;background:#fffbeb;border:1px solid #fcd34d;color:#92400e;font-size:9pt;font-weight:700;text-align:center;}");
        html.append("</style></head><body>");

        if (Boolean.TRUE.equals(req.isPreview()) && req.previewWatermark() != null && !req.previewWatermark().isBlank()) {
            html.append("<p class=\"preview-banner\">").append(esc(req.previewWatermark())).append("</p>");
        }

        html.append("<div class=\"header\">");
        html.append("<p class=\"kicker\">AI Job Evaluation</p>");
        html.append("<h1>").append(esc(req.title())).append("</h1>");
        html.append("<p class=\"job-subtitle\">").append(esc(req.company())).append(" · ").append(esc(req.location())).append("</p>");
        html.append("<div class=\"pills\">");
        if (req.matchPercent() != null) {
            html.append("<span class=\"pill\">").append(req.matchPercent()).append("% match</span>");
        }
        if (req.overallScore() != null) {
            html.append("<span class=\"pill\">Overall score: ").append(req.overallScore()).append("/100</span>");
        }
        if (req.verdict() != null && !req.verdict().isBlank()) {
            html.append("<span class=\"pill\">").append(esc(req.verdict())).append("</span>");
        }
        html.append("</div></div>");

        if (req.applyScore() != null) {
            html.append("<div class=\"apply-hero\">");
            html.append("<div class=\"apply-score\">").append(String.format(Locale.ROOT, "%.1f", req.applyScore()))
                .append(" <span style=\"font-size:12pt;color:#64748b;font-weight:600\">/ 5</span></div>");
            html.append("<div style=\"font-size:10pt;color:#64748b;margin-top:4px\">Apply score</div>");
            if (req.archetype() != null && !req.archetype().isBlank()) {
                html.append("<div style=\"margin-top:6px;font-size:9pt;font-weight:700;color:#0058be\">")
                    .append(esc(req.archetype())).append("</div>");
            }
            String gateMsg = req.applyGateMessage() != null ? req.applyGateMessage() : applyGateMessage(req.applyScore());
            String gateClass = applyGateClass(req.applyScore());
            html.append("<p class=\"apply-gate ").append(gateClass).append("\"><strong>Apply gate:</strong> ")
                .append(esc(gateMsg)).append("</p>");
            html.append("</div>");
        } else if (req.archetype() != null && !req.archetype().isBlank()) {
            html.append("<p style=\"margin:12px 0;font-size:10pt\"><strong>Archetype:</strong> ")
                .append(esc(req.archetype())).append("</p>");
        }

        if (req.sponsorshipMatch() != null || req.salaryMatch() != null) {
            html.append("<p class=\"fit-row\">");
            if (req.sponsorshipMatch() != null) {
                html.append("Sponsorship: <strong>")
                    .append(req.sponsorshipMatch() ? "Aligned" : "Check posting")
                    .append("</strong>");
            }
            if (req.sponsorshipMatch() != null && req.salaryMatch() != null) {
                html.append(" · ");
            }
            if (req.salaryMatch() != null) {
                html.append("Salary band: <strong>")
                    .append(req.salaryMatch() ? "Within target" : "Review range")
                    .append("</strong>");
            }
            html.append("</p>");
        }

        if (req.humanSummary() != null && !req.humanSummary().isBlank()) {
            html.append("<p class=\"summary\">").append(escMultiline(req.humanSummary())).append("</p>");
        }

        appendDimensionTable(html, req.dimensions());
        if (req.dimensions() == null || req.dimensions().isEmpty()) {
            appendLegacyDimensionGrid(html, req.dimensionScores());
        }

        html.append("<p class=\"legend\"><strong>How we compare skills:</strong> we list skills from the job description and check your ")
            .append("entire CV for each. <strong>Matched</strong> = found in your CV. <strong>Gaps</strong> = asked in the posting but not found in your CV.</p>");

        JobEvaluationPdfRequest.EvaluationSectionsDto sections = req.sections();

        html.append("<div class=\"pillar-block pillar-strong\">");
        html.append("<h3>What's strong (your CV ↔ posting)</h3>");
        if (req.matchedSkills() == null || req.matchedSkills().isEmpty()) {
            html.append("<p>No explicit skill matches recorded yet.</p>");
        } else {
            appendSkillList(html, req.matchedSkills());
        }
        if (sections != null && sections.backgroundMatch() != null && !sections.backgroundMatch().isBlank()) {
            html.append("<p>").append(escMultiline(sections.backgroundMatch())).append("</p>");
        }
        html.append("</div>");

        html.append("<div class=\"pillar-block pillar-improve\">");
        html.append("<h3>Gaps &amp; CV coaching</h3>");
        appendSkillList(html, req.unmatchedSkills());
        appendTipList(html, req.cvImprovementTips());
        html.append("</div>");

        html.append("<div class=\"pillar-block pillar-action\">");
        html.append("<h3>What to do next</h3>");
        appendNextStepsList(html, req.nextSteps());
        if (sections != null) {
            appendActionBlock(html, "Position yourself", sections.positioningStrategy());
            appendActionBlock(html, "Tailor your CV", sections.tailoringPlan());
            appendActionBlock(html, "Prepare for interviews", sections.interviewPrep());
        }
        html.append("</div>");

        if (hasAnySection(sections)) {
            html.append("<h2 class=\"full-title\">Full analysis (A–F)</h2>");
            appendFullSection(html, "A. Executive summary", sections.executiveSummary());
            appendFullSection(html, "B. Background match", sections.backgroundMatch());
            appendFullSection(html, "C. Positioning strategy", sections.positioningStrategy());
            appendFullSection(html, "D. Compensation &amp; market", sections.compensationAndMarket());
            appendFullSection(html, "E. CV tailoring plan", sections.tailoringPlan());
            appendFullSection(html, "F. Interview preparation", sections.interviewPrep());
        }

        if (req.storyBankCandidates() != null && !req.storyBankCandidates().isEmpty()) {
            html.append("<div class=\"story-block\"><h2>Story bank candidates</h2>");
            appendSkillList(html, req.storyBankCandidates());
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

    private static boolean hasAnySection(JobEvaluationPdfRequest.EvaluationSectionsDto sections) {
        if (sections == null) return false;
        return isNonBlank(sections.executiveSummary())
            || isNonBlank(sections.backgroundMatch())
            || isNonBlank(sections.positioningStrategy())
            || isNonBlank(sections.compensationAndMarket())
            || isNonBlank(sections.tailoringPlan())
            || isNonBlank(sections.interviewPrep());
    }

    private static boolean isNonBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static String applyGateMessage(Double applyScore) {
        if (applyScore == null) {
            return "Run a full evaluation for an apply recommendation.";
        }
        if (applyScore >= 4.0) {
            return "Meets CareerOps apply threshold (4.0/5).";
        }
        if (applyScore >= 3.0) {
            return "Stretch role — improve gaps before applying.";
        }
        return "Below apply threshold — consider skipping.";
    }

    private static String applyGateClass(Double applyScore) {
        if (applyScore == null) return "apply-gate-caution";
        if (applyScore >= 4.0) return "apply-gate-go";
        if (applyScore >= 3.0) return "apply-gate-caution";
        return "apply-gate-stop";
    }

    private static void appendDimensionTable(StringBuilder html, List<JobEvaluationPdfRequest.DimensionDto> dimensions) {
        if (dimensions == null || dimensions.isEmpty()) return;
        html.append("<h2 style=\"font-size:11pt;margin:16px 0 8px\">Rubric breakdown</h2>");
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

    private static void appendLegacyDimensionGrid(StringBuilder html, Map<String, Double> scores) {
        if (scores == null || scores.isEmpty()) return;
        html.append("<h2 style=\"font-size:11pt;margin:16px 0 8px\">Dimension scores</h2>");
        html.append("<table class=\"dim-table\"><thead><tr><th>Dimension</th><th>Score</th></tr></thead><tbody>");
        for (Map.Entry<String, Double> e : scores.entrySet()) {
            html.append("<tr><td>").append(esc(formatDimensionLabel(e.getKey())))
                .append("</td><td>").append(formatScore(e.getValue())).append("</td></tr>");
        }
        html.append("</tbody></table>");
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

    private static void appendNextStepsList(StringBuilder html, List<String> steps) {
        if (steps == null || steps.isEmpty()) return;
        html.append("<ul>");
        for (String step : steps) {
            if (step != null && !step.isBlank()) {
                html.append("<li>").append(esc(step)).append("</li>");
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

    private static List<JobEvaluationPdfRequest.DimensionDto> extractDimensionDtos(JsonNode breakdown) {
        if (breakdown == null || !breakdown.path("dimensions").isArray()) {
            return List.of();
        }
        List<JobEvaluationPdfRequest.DimensionDto> out = new ArrayList<>();
        for (JsonNode d : breakdown.get("dimensions")) {
            String key = d.path("key").asText(null);
            if (key == null || key.isBlank()) continue;
            Double score = d.has("score") ? d.path("score").asDouble() : null;
            Double weight = d.has("weight") ? d.path("weight").asDouble() : null;
            String label = d.path("label").asText(null);
            String reason = d.path("reason").asText(null);
            out.add(new JobEvaluationPdfRequest.DimensionDto(key, label, score, weight, reason));
        }
        return out;
    }

    private static Map<String, Double> extractDimensionScores(JsonNode breakdown) {
        if (breakdown == null || !breakdown.isObject()) return Map.of();
        java.util.Map<String, Double> scores = new java.util.LinkedHashMap<>();
        Iterator<Map.Entry<String, JsonNode>> fields = breakdown.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> f = fields.next();
            String key = f.getKey();
            if (isMetadataKey(key)) continue;
            if (f.getValue().isNumber()) {
                scores.put(key, f.getValue().doubleValue());
            }
        }
        return scores;
    }

    private static boolean isMetadataKey(String key) {
        return "sections".equals(key) || "overallScore".equals(key) || "matchPercent".equals(key)
            || "matchedSkills".equals(key) || "unmatchedSkills".equals(key)
            || "cvImprovementTips".equals(key) || "verdict".equals(key) || "humanSummary".equals(key)
            || "sponsorshipMatch".equals(key) || "salaryMatch".equals(key)
            || "dimensions".equals(key) || "applyScore".equals(key) || "archetype".equals(key)
            || "schemaVersion".equals(key) || "evaluationStatus".equals(key) || "source".equals(key)
            || "generatedAt".equals(key) || "nextSteps".equals(key) || "storyBankCandidates".equals(key);
    }

    private static List<String> stringList(JsonNode node, String field) {
        if (node == null || !node.has(field) || !node.get(field).isArray()) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        node.get(field).forEach(n -> {
            String s = n.asText(null);
            if (s != null && !s.isBlank()) out.add(s);
        });
        return out;
    }

    private static Boolean boolField(JsonNode node, String field) {
        if (node == null || !node.has(field)) return null;
        return node.get(field).asBoolean();
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
        String plain = plainText(s);
        return plain.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static String escMultiline(String s) {
        return esc(s).replace("\n", "<br/>");
    }

    private static String plainText(String s) {
        if (s == null || s.isBlank()) return "";
        if (!s.contains("<") && !s.contains("&")) return s;
        return org.jsoup.Jsoup.parse(s).text();
    }
}
