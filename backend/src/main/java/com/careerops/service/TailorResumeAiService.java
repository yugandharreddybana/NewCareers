package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/**
 * Tailor CV via the bundled {@code career-ops-skills/tailor-resume/SKILL.md} instructions
 * (loaded through {@link SkillPromptLibrary}) — plan (Steps 0–2) then full rewrite (Step 3).
 */
@Service
public class TailorResumeAiService {

    private static final Logger log = LoggerFactory.getLogger(TailorResumeAiService.class);
    private static final int MAX_CV_CHARS = 28_000;
    private static final int MAX_JD_CHARS = 10_000;
    private static final int MAX_SECTION_CHARS = 16_000;

    private final NvidiaService nvidia;
    private final CvSkillExtractionService skillExtraction;
    private final SkillPromptLibrary skillPrompts;
    private final ObjectMapper mapper;
    private final TokenUsageService tokenUsage;
    private final long dailyTokenBudget;

    public TailorResumeAiService(
            NvidiaService nvidia,
            CvSkillExtractionService skillExtraction,
            SkillPromptLibrary skillPrompts,
            ObjectMapper mapper,
            TokenUsageService tokenUsage,
            @Value("${ai.daily.token.budget:500000}") long dailyTokenBudget) {
        this.nvidia = nvidia;
        this.skillExtraction = skillExtraction;
        this.skillPrompts = skillPrompts;
        this.mapper = mapper;
        this.tokenUsage = tokenUsage;
        this.dailyTokenBudget = dailyTokenBudget;
    }

    public boolean isAvailable() {
        return nvidia != null;
    }

    /**
     * @return tailored JSON (summary, sections[], keywordsAdded, tailoringPlan) or empty if AI unavailable/failed
     */
    public Optional<ObjectNode> tryBuild(
            UUID userId,
            UserProfile profile,
            Job job,
            String cvText,
            List<CvMarkdownSections.Section> parsedSections) {
        try {
            if (tokenUsage.hasExceededBudget(userId, dailyTokenBudget)) {
                log.info("Skipping AI tailor — daily token budget exhausted for userId={}", userId);
                return Optional.empty();
            }
            String cv = truncate(cvText, MAX_CV_CHARS);
            String jd = truncate(jobDescription(job), MAX_JD_CHARS);
            if (cv.isBlank() || jd.isBlank()) {
                return Optional.empty();
            }

            String jobHay = jobHaystack(job);
            List<String> userSkills = CvSkillCanonical.dedupeCanonical(
                skillExtraction.extractForUser(userId, profile, cv));
            List<String> matched = CvSkillCanonical.dedupeCanonical(
                skillExtraction.matchedInJob(userSkills, jobHay));
            List<String> gaps = CvSkillCanonical.dedupeCanonical(
                skillExtraction.gapsInJob(userSkills, jd));

            JsonNode plan = generatePlan(userId, profile, job, cv, jd, matched, gaps, parsedSections);
            ObjectNode tailored = generateTailoredCv(
                userId, profile, job, cv, jd, matched, gaps, parsedSections, plan);
            if (!TailorResumeQuality.isSubstantiallyTailored(tailored)) {
                log.warn("AI tailor output too similar to baseline for userId={} job={}", userId, job.getTitle());
                return Optional.empty();
            }
            if (plan != null && plan.has("tailoringPlan")) {
                tailored.put("tailoringPlan", plan.path("tailoringPlan").asText(""));
            } else if (plan != null && plan.has("tailoringPlanText")) {
                tailored.put("tailoringPlan", plan.path("tailoringPlanText").asText(""));
            }
            tailored.put("mode", "ai_skill_md");
            return Optional.of(tailored);
        } catch (Exception e) {
            log.warn("AI tailor failed: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * SKILL.md + reference docs (ats-rules, resume-template, professional-summary-contract, etc.)
     */
    String skillSystemPrompt(UUID userId) {
        return skillPrompts.buildBackendSkillSystemPrompt("tailor-resume", userId);
    }

    private JsonNode generatePlan(
            UUID userId,
            UserProfile profile,
            Job job,
            String cv,
            String jd,
            List<String> matched,
            List<String> gaps,
            List<CvMarkdownSections.Section> sections) {
        String system = skillSystemPrompt(userId)
            + """

            ---
            ## PHASE A — PLAN ONLY (execute SKILL.md Steps 0, 1, and 2)

            Do NOT write the full CV yet. Complete:
            - Step 0: understand profile + CV + this job posting
            - Step 1: extract 15–20 ATS keywords from the JD (exact phrases from requirements)
            - Step 2: detect language/locale (A4 vs Letter) for the final CV

            Then produce a tailoring plan: gap analysis, which sections to stress, how to reorder
            experience bullets by JD priority, and keyword placement strategy.

            Return **valid JSON only** (no markdown fences):
            {
              "tailoringPlan": "2-4 paragraphs as required by the skill",
              "topKeywords": ["15-20 ATS keywords from Step 1"],
              "matchedFromCv": ["skills already evidenced in CV"],
              "gapsToClose": ["JD requirements weak in CV — only if adjacent proof may exist"],
              "locale": "A4 or Letter per Step 2",
              "sectionStrategies": [
                {"sectionName": "Professional Summary|Work Experience|Skills|...", "strategy": "...", "priority": 1}
              ],
              "experienceBulletOrder": "per-role reorder instructions (most JD-relevant bullets first)"
            }
            """;

        String user = buildContextBlock(profile, job, cv, jd, matched, gaps)
            + "\n\nCV sections detected:\n"
            + sectionOutline(sections)
            + "\n\nExecute PHASE A now. Return the plan JSON only.";

        return nvidia.generateJson(system, user, userId, "tailor-resume-plan");
    }

    private ObjectNode generateTailoredCv(
            UUID userId,
            UserProfile profile,
            Job job,
            String cv,
            String jd,
            List<String> matched,
            List<String> gaps,
            List<CvMarkdownSections.Section> parsedSections,
            JsonNode plan) {
        String system = skillSystemPrompt(userId)
            + """

            ---
            ## PHASE B — WRITE THE TAILORED CV (execute SKILL.md Step 3 strictly)

            You have a tailoring plan from Phase A. Now build the full resume content:

            1. Work through **each section** listed in the USER message in order.
            2. For **Professional Summary**: exactly three sentences (Who you are / Key skills / Value) per SKILL.md.
            3. For **Work Experience**: keep real employers, titles, dates; reorder bullets by JD relevance;
               each role: role & scope, Actions, Impact (metrics), Value; then **Key Achievements:** bullets
               (Action + Impact — NOT Artificial Intelligence).
            4. **Skills**: JD keywords first; acronym + full form where applicable.
            5. **Education / Certifications / Projects / all other sections**: include **every** section from the source CV.
               Tailor wording for the JD — do **not** delete roles, employers, dates, bullets, skill categories, or entries.

            **COMPLETENESS (mandatory):**
            - One `sections[]` row for **each** CV section in the USER message (same names, same scope).
            - Every employer, job title, date range, education line, skill, certification, and project from the source CV
              must appear in the matching `rewritten` field (reordered/reworded is fine; omission is not).
            - If the source CV lists 4 jobs, the Experience `rewritten` must still contain all 4 jobs.
            - If Skills lists multiple categories (Frontend, Backend, etc.), preserve **all** categories and **all** items.

            Every `rewritten` field must be a **complete rewrite** for this job — not a copy of `original`, and not a summary.
            Mirror JD language exactly. Irish English. No banned AI clichés from the skill.

            Return **valid JSON only** (no markdown fences). This API does not use tools — return:
            - summary: string (same 3-sentence block as Professional Summary section)
            - keywordsAdded: string[] (keywords woven in from Step 1)
            - sections: [{ name, original, rewritten, rationale }] — one entry per source section;
              Professional Summary first; Experience must include Key Achievements blocks per SKILL.md
            - warnings: string[] (honest gaps, missing metrics, etc.)
            - tailoringPlan: optional short recap of Phase A (if not already in plan)

            The server builds HTML from this JSON. Do not return raw HTML.
            """;

        String user = buildContextBlock(profile, job, cv, jd, matched, gaps)
            + "\n\n--- PHASE A TAILORING PLAN (follow this) ---\n"
            + (plan != null ? plan.toString() : "{}")
            + "\n\n--- SECTIONS TO REWRITE (copy each `original` verbatim; write new `rewritten`) ---\n"
            + sectionsPayload(parsedSections)
            + "\n\nExecute PHASE B now. Return the JSON only.";

        JsonNode raw = nvidia.generateJson(system, user, userId, "tailor-resume-write");
        return mergeParsedSections(raw, parsedSections, cv);
    }

    private ObjectNode mergeParsedSections(
            JsonNode raw,
            List<CvMarkdownSections.Section> parsedSections,
            String fullCv) {
        ObjectNode out = raw != null && raw.isObject()
            ? (ObjectNode) raw.deepCopy()
            : mapper.createObjectNode();

        ArrayNode merged = mapper.createArrayNode();
        java.util.Map<String, JsonNode> aiByName = new java.util.LinkedHashMap<>();
        if (out.has("sections") && out.get("sections").isArray()) {
            for (JsonNode row : out.get("sections")) {
                String key = row.path("name").asText("").trim().toLowerCase(Locale.ROOT);
                if (!key.isBlank()) {
                    aiByName.put(key, row);
                }
            }
        }

        LinkedHashSet<String> seen = new LinkedHashSet<>();
        for (CvMarkdownSections.Section sec : parsedSections) {
            String key = sec.name().trim().toLowerCase(Locale.ROOT);
            seen.add(key);
            JsonNode aiRow = aiByName.get(key);
            ObjectNode row = mapper.createObjectNode();
            row.put("name", sec.name());
            row.put("original", sec.body());
            if (aiRow != null && !aiRow.path("rewritten").asText("").isBlank()) {
                row.put("rewritten", aiRow.path("rewritten").asText(""));
                row.put("rationale", aiRow.path("rationale").asText("Tailored for this job posting."));
            } else {
                row.put("rewritten", sec.body());
                row.put("rationale", "Preserved from your CV — AI did not return this section; review for JD keywords.");
            }
            merged.add(row);
        }

        for (JsonNode aiRow : aiByName.values()) {
            String key = aiRow.path("name").asText("").trim().toLowerCase(Locale.ROOT);
            if (key.isBlank() || seen.contains(key)) continue;
            merged.add(aiRow.deepCopy());
        }

        out.set("sections", merged);

        if (!out.has("summary") || out.path("summary").asText("").isBlank()) {
            for (JsonNode row : merged) {
                if (row.path("name").asText("").toLowerCase(Locale.ROOT).contains("summary")) {
                    out.put("summary", row.path("rewritten").asText(""));
                    break;
                }
            }
        }

        out.put("baselineMarkdown", fullCv != null ? fullCv.trim() : "");
        return out;
    }

    private static String buildContextBlock(
            UserProfile profile,
            Job job,
            String cv,
            String jd,
            List<String> matched,
            List<String> gaps) {
        String roleLabel = ApplyAssistService.inferRoleLabel(job, profile);
        StringBuilder sb = new StringBuilder();
        sb.append("TARGET ROLE: ").append(safe(job.getTitle())).append(" at ").append(safe(job.getCompany()));
        sb.append("\nCANDIDATE POSITIONING: ").append(roleLabel);
        if (profile != null && profile.getTechStack() != null && profile.getTechStack().length > 0) {
            sb.append("\nPROFILE TECH STACK: ").append(String.join(", ", profile.getTechStack()));
        }
        if (profile != null && profile.getTargetRoles() != null && profile.getTargetRoles().length > 0) {
            sb.append("\nTARGET ROLES: ").append(String.join(", ", profile.getTargetRoles()));
        }
        sb.append("\nMATCHED SKILLS (CV + posting): ").append(matched.isEmpty() ? "none" : String.join(", ", matched));
        sb.append("\nGAPS (posting asks; weak in CV): ")
            .append(gaps.isEmpty() ? "none flagged" : String.join(", ", gaps));
        sb.append("\n\n--- JOB DESCRIPTION ---\n").append(jd);
        sb.append("\n\n--- CURRENT CV (data/resume.md) ---\n").append(cv);
        return sb.toString();
    }

    private static String sectionOutline(List<CvMarkdownSections.Section> sections) {
        StringBuilder sb = new StringBuilder();
        for (CvMarkdownSections.Section s : sections) {
            sb.append("- ").append(s.name()).append(" (")
                .append(s.body().length()).append(" chars)\n");
        }
        return sb.toString();
    }

    private static String sectionsPayload(List<CvMarkdownSections.Section> sections) {
        StringBuilder sb = new StringBuilder();
        for (CvMarkdownSections.Section s : sections) {
            sb.append("\n### ").append(s.name()).append("\n");
            sb.append(truncate(s.body(), MAX_SECTION_CHARS)).append("\n");
        }
        return sb.toString();
    }

    private static String jobDescription(Job job) {
        if (job == null) return "";
        return ((job.getTitle() == null ? "" : job.getTitle()) + "\n"
            + (job.getDescription() == null ? "" : job.getDescription())).trim();
    }

    private static String jobHaystack(Job job) {
        return jobDescription(job).toLowerCase(Locale.ROOT);
    }

    private static String safe(String s) {
        return s == null || s.isBlank() ? "—" : s.trim();
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        String t = s.trim();
        return t.length() <= max ? t : t.substring(0, max) + "\n…[truncated]";
    }
}
