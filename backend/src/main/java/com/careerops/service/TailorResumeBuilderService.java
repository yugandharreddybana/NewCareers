package com.careerops.service;

import com.careerops.debug.DebugSessionLog;
import com.careerops.model.Job;
import com.careerops.model.User;
import com.careerops.model.UserProfile;
import com.careerops.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.Optional;

/**
 * Deterministic, job-specific CV tailoring from full CV text + JD (no hallucinated employers).
 */
@Service
public class TailorResumeBuilderService {

    private final CvSkillExtractionService skillExtraction;
    private final TailorResumeHtmlRenderer htmlRenderer;
    private final TailorResumeAiService tailorResumeAi;
    private final UserRepository users;
    private final ObjectMapper mapper;

    public TailorResumeBuilderService(
            CvSkillExtractionService skillExtraction,
            TailorResumeHtmlRenderer htmlRenderer,
            TailorResumeAiService tailorResumeAi,
            UserRepository users,
            ObjectMapper mapper) {
        this.skillExtraction = skillExtraction;
        this.htmlRenderer = htmlRenderer;
        this.tailorResumeAi = tailorResumeAi;
        this.users = users;
        this.mapper = mapper;
    }

    public ObjectNode build(
            UUID userId,
            UserProfile profile,
            Job job,
            String cvText,
            String sourceTag) {
        String baseline = cvText != null ? cvText.trim() : "";
        List<CvMarkdownSections.Section> parsed = CvMarkdownSections.parse(baseline);

        Optional<ObjectNode> ai = tailorResumeAi.tryBuild(userId, profile, job, baseline, parsed);
        if (ai.isPresent()) {
            // #region agent log
            DebugSessionLog.write(
                "TailorResumeBuilderService.build",
                "ai_path",
                "H-AI",
                Map.of("sourceTag", sourceTag, "parsedSectionCount", parsed.size()));
            // #endregion
            return finalizeOutput(ai.get(), profile, job, userId, baseline, sourceTag + "_ai");
        }

        List<CvMarkdownSections.Section> resolved = TailorResumeDeterministicSupport
            .ensureTailorableSections(parsed, profile, baseline);
        ObjectNode deterministic = buildDeterministic(userId, profile, job, baseline, resolved);
        if (tailorResumeAi.isAvailable()) {
            ArrayNode warnings = deterministic.has("warnings") && deterministic.get("warnings").isArray()
                ? (ArrayNode) deterministic.get("warnings")
                : mapper.createArrayNode();
            warnings.add(
                "AI tailoring did not pass quality checks — showing a keyword-assisted draft instead. "
                    + "Try again; if this persists, check backend logs for quality_gate_rejected.");
            deterministic.set("warnings", warnings);
        }
        // #region agent log
        DebugSessionLog.write(
            "TailorResumeBuilderService.build",
            "deterministic_path",
            "H-FALLBACK",
            Map.of(
                "sourceTag", sourceTag,
                "parsedSectionCount", parsed.size(),
                "resolvedSectionCount", resolved.size(),
                "outputSectionCount", deterministic.path("sections").size(),
                "aiAvailable", tailorResumeAi.isAvailable()));
        // #endregion
        return finalizeOutput(deterministic, profile, job, userId, baseline, sourceTag);
    }

    private ObjectNode buildDeterministic(
            UUID userId,
            UserProfile profile,
            Job job,
            String baseline,
            List<CvMarkdownSections.Section> parsed) {
        String jobHay = jobHaystack(job);
        List<String> skills = CvSkillCanonical.dedupeCanonical(
            skillExtraction.extractForUser(userId, profile, baseline));
        List<String> matched = CvSkillCanonical.dedupeCanonical(
            skillExtraction.matchedInJob(skills, jobHay));
        List<String> gaps = CvSkillCanonical.dedupeCanonical(
            skillExtraction.gapsInJob(skills, job.getDescription() != null ? job.getDescription() : jobHay));

        String summary = TailorResumeDeterministicSupport.buildThreeSentenceSummary(profile, job, matched);
        ArrayNode sections = mapper.createArrayNode();

        for (CvMarkdownSections.Section sec : parsed) {
            ObjectNode row = mapper.createObjectNode();
            row.put("name", sec.name());
            row.put("original", sec.body());
            row.put("rewritten", tailorSection(sec.name(), sec.body(), job, matched, gaps, summary));
            row.put("rationale", rationaleFor(sec.name(), job, matched));
            sections.add(row);
        }

        if (sections.isEmpty()) {
            ObjectNode row = mapper.createObjectNode();
            row.put("name", "Professional summary");
            row.put("original", truncate(baseline, 1500));
            row.put("rewritten", summary);
            row.put("rationale", "Role-targeted opening derived from your CV and the job description.");
            sections.add(row);
        }

        ObjectNode out = mapper.createObjectNode();
        out.put("summary", summary);
        out.put("mode", "deterministic");
        out.set("sections", sections);
        ArrayNode kw = mapper.createArrayNode();
        matched.forEach(kw::add);
        out.set("keywordsAdded", kw);
        ArrayNode warnings = mapper.createArrayNode();
        warnings.add("AI tailoring was unavailable — this is a keyword-assisted draft. Re-run when NVIDIA is configured.");
        out.set("warnings", warnings);
        return out;
    }

    private ObjectNode finalizeOutput(
            ObjectNode core,
            UserProfile profile,
            Job job,
            UUID userId,
            String baseline,
            String sourceTag) {
        String summary = core.path("summary").asText("");
        JsonNode sectionsNode = core.path("sections");
        if (summary.isBlank() && sectionsNode.isArray()) {
            for (JsonNode row : sectionsNode) {
                if (row.path("name").asText("").toLowerCase(Locale.ROOT).contains("summary")) {
                    summary = row.path("rewritten").asText("");
                    break;
                }
            }
        }

        ObjectNode out = core.deepCopy();
        out.put("summary", summary);
        out.put("mode", core.path("mode").asText(sourceTag));
        if (job != null && job.getTitle() != null && !job.getTitle().isBlank()) {
            out.put("jobTitle", job.getTitle().trim());
        }
        out.put("baselineMarkdown", baseline);
        repairThinOutputInPlace(out, profile, job, userId);
        repairExperienceSectionsInPlace(out, profile, job, userId);
        TailorResumeSectionSanitizer.sanitizeOutputInPlace(out);
        sectionsNode = out.path("sections");
        out.put("tailoredMarkdown", htmlRenderer.sectionsToMarkdown(sectionsNode, summary));
        if (!out.has("keywordsAdded")) {
            out.set("keywordsAdded", mapper.createArrayNode());
        }
        User user = loadUser(userId);
        out.put("resumeHtml", htmlRenderer.render(
            user, profile, job, out.path("jobTitle").asText(""), summary, sectionsNode));
        out.put("resumeReady", true);
        return out;
    }

    /**
     * Rebuilds summary + sections when output is legacy template or too thin to render a full CV.
     *
     * @return true when sections were rebuilt
     */
    public boolean repairThinOutputInPlace(
            ObjectNode out,
            UserProfile profile,
            Job job,
            UUID userId) {
        if (out == null || !TailorResumeDeterministicSupport.needsSectionRepair(out)) {
            return false;
        }
        String baseline = out.path("baselineMarkdown").asText("");
        if (baseline.isBlank()) {
            baseline = reconstructBaselineFromSections(out.path("sections"));
        }
        if (baseline.isBlank()) {
            return false;
        }
        List<CvMarkdownSections.Section> resolved = TailorResumeDeterministicSupport
            .ensureTailorableSections(CvMarkdownSections.parse(baseline), profile, baseline);
        ObjectNode rebuilt = buildDeterministic(userId, profile, job, baseline, resolved);
        out.put("summary", rebuilt.path("summary").asText(""));
        out.set("sections", rebuilt.path("sections"));
        if (out.path("keywordsAdded").isEmpty()) {
            out.set("keywordsAdded", rebuilt.path("keywordsAdded"));
        }
        ArrayNode warnings = out.has("warnings") && out.get("warnings").isArray()
            ? (ArrayNode) out.get("warnings")
            : mapper.createArrayNode();
        warnings.add("Rebuilt thin CV sections from your profile and baseline CV.");
        out.set("warnings", warnings);
        out.put("baselineMarkdown", baseline);
        // #region agent log
        DebugSessionLog.write(
            "TailorResumeBuilderService.repairThinOutputInPlace",
            "section_repair",
            "H-REPAIR",
            Map.of(
                "resolvedSectionCount", resolved.size(),
                "outputSectionCount", out.path("sections").size(),
                "legacySummary", TailorResumeDeterministicSupport.isLegacyTemplateSummary(
                    rebuilt.path("summary").asText(""))));
        // #endregion
        return true;
    }

    private static String reconstructBaselineFromSections(JsonNode sections) {
        if (sections == null || !sections.isArray()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (JsonNode row : sections) {
            String original = row.path("original").asText("").trim();
            if (!original.isBlank()) {
                if (!sb.isEmpty()) {
                    sb.append("\n\n");
                }
                sb.append(original);
            }
        }
        return sb.toString().trim();
    }

    /**
     * Keeps role-by-role experience when AI (or a bad rewrite) collapses it into a summary paragraph.
     */
    public void repairExperienceSectionsInPlace(
            ObjectNode out,
            UserProfile profile,
            Job job,
            UUID userId) {
        if (out == null || !out.path("sections").isArray()) {
            return;
        }
        String jobHay = jobHaystack(job);
        List<String> matched = keywordsFrom(out);
        if (matched.isEmpty() && userId != null && profile != null) {
            matched = CvSkillCanonical.dedupeCanonical(
                skillExtraction.extractForUser(userId, profile, out.path("baselineMarkdown").asText("")));
            matched = CvSkillCanonical.dedupeCanonical(skillExtraction.matchedInJob(matched, jobHay));
        }
        List<String> gaps = job != null
            ? CvSkillCanonical.dedupeCanonical(
                skillExtraction.gapsInJob(matched, job.getDescription() != null ? job.getDescription() : jobHay))
            : List.of();

        ArrayNode sections = (ArrayNode) out.path("sections");
        for (JsonNode row : sections) {
            if (!row.isObject()) {
                continue;
            }
            String name = row.path("name").asText("");
            if (!name.toLowerCase(Locale.ROOT).contains("experience")) {
                continue;
            }
            String original = row.path("original").asText("");
            String rewritten = row.path("rewritten").asText("");
            if (!ExperienceSectionParser.needsRepair(original, rewritten)) {
                continue;
            }
            ObjectNode sectionRow = (ObjectNode) row;
            if (job != null) {
                sectionRow.put("rewritten", tailorExperience(original, job, matched, gaps));
            } else {
                sectionRow.put("rewritten", original.trim());
            }
            sectionRow.put(
                "rationale",
                "Restored your real job history — the prior rewrite had collapsed Work Experience into a summary paragraph.");
        }
    }

    private static List<String> keywordsFrom(ObjectNode out) {
        List<String> matched = new ArrayList<>();
        JsonNode kw = out.path("keywordsAdded");
        if (kw.isArray()) {
            kw.forEach(n -> {
                String s = n.asText("").trim();
                if (!s.isBlank()) {
                    matched.add(s);
                }
            });
        }
        return matched;
    }

    /** Re-render HTML + markdown from final sections (after AI merge or normalize). */
    public void attachRenderedPreview(ObjectNode out, UserProfile profile, UUID userId, Job job) {
        if (out == null) return;
        repairExperienceSectionsInPlace(out, profile, job, userId);
        TailorResumeSectionSanitizer.sanitizeOutputInPlace(out);
        JsonNode sectionsNode = out.path("sections");
        String summary = out.path("summary").asText("");
        User user = loadUser(userId);
        out.put("resumeHtml", htmlRenderer.render(
            user, profile, job, out.path("jobTitle").asText(""), summary, sectionsNode));
        out.put("tailoredMarkdown", htmlRenderer.sectionsToMarkdown(sectionsNode, summary));
        out.put("resumeReady", true);
    }

    /** Backward-compatible overload when User/Job context is unavailable. */
    public void attachRenderedPreview(ObjectNode out, UserProfile profile) {
        attachRenderedPreview(out, profile, profile != null ? profile.getUserId() : null, null);
    }

    /** Re-render preview HTML from saved run JSON (strips legacy "CV" dump sections). */
    public String renderPreviewFromOutput(UserProfile profile, User user, Job job, JsonNode output) {
        if (output == null || !output.isObject()) {
            return "";
        }
        ObjectNode copy = output.deepCopy();
        UUID userId = profile != null ? profile.getUserId() : (user != null ? user.getId() : null);
        User resolvedUser = user != null ? user : loadUser(userId);
        repairThinOutputInPlace(copy, profile, job, userId);
        repairExperienceSectionsInPlace(copy, profile, job, userId);
        String baseline = copy.path("baselineMarkdown").asText("");
        JsonNode sections = TailorResumeSectionSanitizer.sanitize(copy.path("sections"), baseline);
        return htmlRenderer.render(
            resolvedUser, profile, job, copy.path("jobTitle").asText(""),
            copy.path("summary").asText(""), sections);
    }

    /** Backward-compatible overload. */
    public String renderPreviewFromOutput(UserProfile profile, JsonNode output) {
        return renderPreviewFromOutput(profile, null, null, output);
    }

    private User loadUser(UUID userId) {
        if (userId == null) {
            return null;
        }
        return users.findById(userId).orElse(null);
    }

    public String tailoredMarkdownFromOutput(JsonNode output) {
        if (output == null || !output.isObject()) {
            return "";
        }
        String baseline = output.path("baselineMarkdown").asText("");
        JsonNode sections = TailorResumeSectionSanitizer.sanitize(output.path("sections"), baseline);
        return htmlRenderer.sectionsToMarkdown(sections, output.path("summary").asText(""));
    }

    private String tailorSection(
            String name,
            String original,
            Job job,
            List<String> matched,
            List<String> unmatched,
            String summary) {
        if (name.toLowerCase(Locale.ROOT).contains("summary")) {
            return summary;
        }
        if (name.toLowerCase(Locale.ROOT).contains("experience")) {
            return tailorExperience(original, job, matched, unmatched);
        }
        if (name.toLowerCase(Locale.ROOT).contains("education")) {
            return emphasizeKeywords(original, matched, 6);
        }
        if (name.toLowerCase(Locale.ROOT).contains("skill")) {
            return buildSkillsBlock(original, matched, unmatched);
        }
        return emphasizeKeywords(original, matched, 10);
    }

    private String tailorExperience(String original, Job job, List<String> matched, List<String> gaps) {
        if (original == null || original.isBlank()) {
            return "(No experience section found in your CV — upload a fuller CV in Settings.)";
        }
        String[] lines = original.split("\\r?\\n");
        List<String> outLines = new ArrayList<>();
        List<String> bulletBuffer = new ArrayList<>();

        Runnable flushBullets = () -> {
            if (bulletBuffer.isEmpty()) return;
            for (String b : reorderBulletsByRelevance(bulletBuffer, matched, job)) {
                outLines.add(b);
            }
            bulletBuffer.clear();
        };

        for (String line : lines) {
            String t = line.strip();
            if (t.isBlank()) {
                flushBullets.run();
                outLines.add("");
                continue;
            }
            if (isExperienceBullet(t)) {
                bulletBuffer.add(rewriteBullet(t, matched, job));
            } else {
                flushBullets.run();
                outLines.add(t);
            }
        }
        flushBullets.run();
        return String.join("\n", outLines).trim();
    }

    private static boolean isExperienceBullet(String t) {
        String lower = t.toLowerCase(Locale.ROOT);
        return t.startsWith("•") || t.startsWith("-") || t.startsWith("*")
            || lower.startsWith("challenge") || lower.startsWith("action")
            || lower.startsWith("result") || lower.startsWith("key achievements");
    }

    private static String rewriteBullet(String bullet, List<String> matched, Job job) {
        String enhanced = injectMatchedTerms(bullet, matched);
        String lower = enhanced.toLowerCase(Locale.ROOT);
        for (String m : matched) {
            if (CvSkillCanonical.jobHaystackContains(lower, m)) {
                return enhanced;
            }
        }
        if (!matched.isEmpty() && !enhanced.endsWith(".")) {
            return enhanced + " — emphasising " + matched.get(0) + " delivery.";
        }
        return enhanced;
    }

    private static List<String> reorderBulletsByRelevance(
            List<String> bullets,
            List<String> matched,
            Job job) {
        String hay = jobHaystack(job);
        record Scored(String bullet, int score) {}
        List<Scored> scored = new ArrayList<>();
        for (String b : bullets) {
            int score = 0;
            String bl = b.toLowerCase(Locale.ROOT);
            for (String m : matched) {
                if (CvSkillCanonical.jobHaystackContains(bl, m) || CvSkillCanonical.jobHaystackContains(hay, m)) {
                    score += 3;
                }
            }
            if (b.matches(".*\\d+.*")) score += 2;
            scored.add(new Scored(b, score));
        }
        scored.sort((a, b) -> Integer.compare(b.score(), a.score()));
        return scored.stream().map(Scored::bullet).toList();
    }

    private static String injectMatchedTerms(String bullet, List<String> matched) {
        if (matched.isEmpty()) return bullet;
        String lower = bullet.toLowerCase(Locale.ROOT);
        for (String m : matched) {
            if (CvSkillCanonical.jobHaystackContains(lower, m)) {
                return bullet;
            }
        }
        String term = matched.get(0);
        if (bullet.endsWith(".")) {
            return bullet.substring(0, bullet.length() - 1) + " using " + term + ".";
        }
        return bullet + " — " + term;
    }

    private static String buildSkillsBlock(String original, List<String> matched, List<String> unmatched) {
        LinkedHashSet<String> combined = new LinkedHashSet<>(matched);
        if (original != null) {
            for (String line : original.split("[,\\n]")) {
                String t = line.trim();
                if (!t.isBlank()) combined.add(CvSkillCanonical.canonicalize(t));
            }
        }
        StringBuilder sb = new StringBuilder();
        if (!combined.isEmpty()) {
            sb.append(String.join(" · ", combined));
        }
        if (!unmatched.isEmpty()) {
            if (!sb.isEmpty()) sb.append("\n\n");
            sb.append("Developing: ").append(String.join(", ", unmatched.stream().limit(5).toList()));
        }
        return sb.toString().trim();
    }

    private static String emphasizeKeywords(String text, List<String> matched, int maxTerms) {
        if (text == null || text.isBlank()) return text;
        if (matched.isEmpty()) return text;
        String lower = text.toLowerCase(Locale.ROOT);
        List<String> missing = new ArrayList<>();
        for (String m : matched) {
            if (!CvSkillCanonical.jobHaystackContains(lower, m)) {
                missing.add(m);
            }
            if (missing.size() >= maxTerms) break;
        }
        if (missing.isEmpty()) return text;
        return text + "\n\n(Role keywords to surface: " + String.join(", ", missing) + ")";
    }

    private static String rationaleFor(String sectionName, Job job, List<String> matched) {
        return "Tailored " + sectionName.toLowerCase(Locale.ROOT)
            + " for " + safe(job.getTitle()) + " at " + safe(job.getCompany())
            + (matched.isEmpty() ? "." : " — emphasising: " + String.join(", ", matched.stream().limit(5).toList()) + ".");
    }

    private static String jobHaystack(Job job) {
        if (job == null) return "";
        return ((job.getTitle() == null ? "" : job.getTitle()) + "\n"
            + (job.getDescription() == null ? "" : job.getDescription())).toLowerCase(Locale.ROOT);
    }

    private static String safe(String s) {
        return s == null || s.isBlank() ? "—" : s;
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

}
