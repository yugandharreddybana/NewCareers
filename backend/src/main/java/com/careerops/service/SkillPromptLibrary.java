package com.careerops.service;

import org.jspecify.annotations.Nullable;

import com.careerops.dto.CareerMemoryDtos.MemoryResponse;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Loads and caches skill prompts (SKILL.md) and reference documents.
 * Phase 2 extends Phase 1's 9 skills to 14 total.
 *
 * 2-Layer fallback chain (offline/local-first):
 *   Layer 1: Classpath bundled copies (src/main/resources/career-ops-skills/)
 *   Layer 2: Hardcoded minimal inline prompt (absolute last resort)
 */
@Service
public class SkillPromptLibrary {

    private static final Logger log = LoggerFactory.getLogger(SkillPromptLibrary.class);

    // Phase 1 + Phase 2 + plugin catalog skills (help, track)
    static final List<String> ALL_SKILLS = List.of(
        "evaluate", "tailor-resume", "apply", "outreach",
        "research", "prep-interview", "compare", "triage", "scan",
        "salary-negotiation", "culture-fit", "linkedin-optimize",
        "cover-letter", "skills-gap-plan",
        "track", "help"
    );

    static final List<String> REFERENCE_DOCS = List.of(
        "scoring-rubric.md",
        "archetypes.md",
        "ats-rules.md",
        "ats-endpoints.md",
        "resume-template.html",
        "profile-schema.md",
        "professional-summary-contract.md",
        "states.md"
    );

    private static final Map<String, List<String>> SKILL_REFS = Map.ofEntries(
        Map.entry("evaluate",           List.of("scoring-rubric.md", "archetypes.md", "profile-schema.md", "states.md")),
        Map.entry("tailor-resume",       List.of(
                "ats-rules.md", "ats-endpoints.md", "resume-template.html",
                "profile-schema.md", "professional-summary-contract.md")),
        Map.entry("apply",               List.of("profile-schema.md", "states.md")),
        Map.entry("outreach",            List.of("profile-schema.md")),
        Map.entry("research",            List.of("profile-schema.md")),
        Map.entry("prep-interview",      List.of("scoring-rubric.md", "profile-schema.md")),
        Map.entry("compare",             List.of("scoring-rubric.md", "states.md")),
        Map.entry("triage",              List.of("scoring-rubric.md", "states.md")),
        Map.entry("scan",                List.of("profile-schema.md")),
        Map.entry("salary-negotiation",  List.of("profile-schema.md")),
        Map.entry("culture-fit",         List.of("profile-schema.md", "scoring-rubric.md")),
        Map.entry("linkedin-optimize",   List.of("profile-schema.md", "ats-rules.md")),
        Map.entry("cover-letter",        List.of("profile-schema.md", "ats-rules.md")),
        Map.entry("skills-gap-plan",     List.of("profile-schema.md", "scoring-rubric.md")),
        Map.entry("track",               List.of("states.md", "profile-schema.md")),
        Map.entry("help",                List.of())
    );

    private final CareerMemoryService careerMemoryService;

    public SkillPromptLibrary(CareerMemoryService careerMemoryService) {
        this.careerMemoryService = careerMemoryService;
    }

    private final ConcurrentHashMap<String, String> cache = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        log.info("SkillPromptLibrary: loading prompts from bundled career-ops-skills (local-only mode)...");
        loadAll();
        log.info("SkillPromptLibrary: loaded {} entries into cache", cache.size());
    }

    @Scheduled(cron = "0 0 3 * * *")
    public void refresh() {
        log.info("SkillPromptLibrary: scheduled daily refresh started");
        loadAll();
        log.info("SkillPromptLibrary: refresh complete, cache now has {} entries", cache.size());
    }

    // ================================================================
    // PUBLIC API
    // ================================================================

    public String buildFullSystemPrompt(String skillName) {
        return buildFullSystemPrompt(skillName, null);
    }

    public String buildFullSystemPrompt(String skillName, @Nullable UUID userId) {
        String skillMd = getSkillMd(skillName);
        List<String> refs = SKILL_REFS.getOrDefault(skillName, List.of());

        StringBuilder sb = new StringBuilder(skillMd);

        for (String ref : refs) {
            String refContent = cache.get("references/" + ref);
            if (refContent != null && !refContent.isBlank()) {
                sb.append("\n\n---\n## REFERENCE: ").append(ref).append("\n\n");
                sb.append(refContent);
            }
        }

        // Inject enabled career memories for personalisation
        if (userId != null) {
            try {
                List<MemoryResponse> memories = careerMemoryService.listEnabled(userId);
                if (!memories.isEmpty()) {
                    sb.append("\n\n---\n## USER CAREER PREFERENCES (from Agent Memory)\n\n");
                    sb.append("Use these known preferences to personalise your output:\n");
                    for (MemoryResponse m : memories) {
                        sb.append("- **").append(m.key()).append("**: ").append(m.value()).append("\n");
                    }
                }
            } catch (Exception e) {
                log.debug("Could not load career memories for skill prompt: {}", e.getMessage());
            }
        }

        if ("prep-interview".equals(skillName)) {
            sb.append("""
\n\n---\n## INTERVIEW PREP ENHANCED INSTRUCTIONS\n
Generate a comprehensive interview preparation pack with ALL of the following sections:
1. **Personal Questions** - Background, motivation, career goals (min 5)
2. **Easy Technical Questions** - Fundamentals, definitions (min 5)
3. **Medium Technical Questions** - Applied knowledge, patterns (min 5)
4. **Hard Technical Questions** - System design, architecture, edge cases (min 5)
5. **Coding Questions** - Algorithm/data structure problems with hints (min 3)
6. **Questions to Expect** - Company/role-specific likely questions (min 5)
7. **Topics to Study** - Prioritised reading list based on job requirements
For each question, provide the question, ideal answer structure, and what the interviewer is assessing.
""");
        }

        if ("tailor-resume".equals(skillName)) {
            sb.append("""
\n\n---\n## ENHANCED ATS + HUMAN CV RULES (Phase 2)\n
Apply ALL of the following rules when generating the tailored resume:\n
1. PROFESSIONAL SUMMARY (NON-NEGOTIABLE): Read REFERENCE: professional-summary-contract.md.
   Every CV must include a Professional Summary with exactly three sentences in this order:
   (1) Who you are — short intro: profession, background, or area of expertise;
   (2) Key skills/expertise — main skills from past/current roles relevant to THIS job (JD-aligned);
   (3) Value you bring — how the candidate adds value to THIS company/role.
   Do not omit, merge, or reorder these elements. The JSON `summary` field, HTML {{SUMMARY}},
   and sections[].rewritten for "Professional Summary" must all use this same 3-sentence block.
2. WORK EXPERIENCE (NON-NEGOTIABLE): Per tailor-resume SKILL.md — each role covers (in order):
   role & scope, Actions (A), Impact (I) with quantifiable metrics, Value to team/company;
   then a "Key Achievements:" block where every bullet follows AI = Action + Impact
   (Action + Impact only — NOT Artificial Intelligence). CAR (Challenge→Action→Result)
   may inform wording but Key Achievements must use Action + Impact with numbers.
3. Use strong past-tense action verbs only: Led, Built, Delivered, Grew, Reduced, Increased, Launched, Drove, Designed, Implemented, Optimised, Automated.
4. Every achievement MUST include quantification: reduced X by Y% / saved €Z / increased output by N%.
5. BANNED AI-sounding phrases: \"leveraged\", \"spearheaded\", \"synergies\", \"passionate about\", \"team player\", \"results-driven\", \"dynamic\", \"go-getter\", \"thought leader\".
6. First-person authentic voice throughout. Irish English spelling.
7. Every bullet must showcase unique candidate value and business impact to THIS specific employer.
8. Mirror exact keywords from the JD naturally — do not keyword-stuff.

When using agent tools: call save_resume_html with full ATS HTML, then return JSON (no raw HTML in JSON).

When using the CareerOps dedicated tailor API (no tools): return ONLY valid JSON (no markdown fences) with:
- summary: string (EXACTLY 3 sentences per rule 1 — Who you are / Key skills / Value you bring)
- keywordsAdded: string[] (JD keywords woven in)
- sections: [{ name, original, rewritten, rationale }] — must include "Professional Summary" as first section with rewritten matching `summary`
- warnings: string[] (optional ATS issues)
- tailoringPlan: string (optional — gap analysis and section strategy from Steps 0–2)
The server renders HTML from this JSON; do not return raw HTML in the JSON body.
""");
        }

        return sb.toString();
    }

    /**
     * Full SKILL.md + references + career memories + backend API execution block + SaaS JSON contract.
     * Used by {@link SkillMdExecutorService} and dedicated pipelines (e.g. tailor-resume).
     */
    public String buildBackendSkillSystemPrompt(String skillName, @Nullable UUID userId) {
        return buildFullSystemPrompt(skillName, userId) + SkillMdBackendAdapter.executionBlockFor(skillName);
    }

    public String getSkillMd(String skillName) {
        return cache.getOrDefault("skills/" + skillName + "/SKILL.md",
                getFallbackPrompt(skillName));
    }

    // ================================================================
    // LOADING LOGIC
    // ================================================================

    private void loadAll() {
        for (String skill : ALL_SKILLS) {
            String path = "skills/" + skill + "/SKILL.md";
            String content = fetchWithFallback(path);
            if (content != null) cache.put(path, content);
        }
        for (String ref : REFERENCE_DOCS) {
            String path = "references/" + ref;
            String content = fetchWithFallback(path);
            if (content != null) cache.put(path, content);
        }
    }

    private @Nullable String fetchWithFallback(String filePath) {
        String content = loadFromClasspath(filePath);
        if (content != null) {
            log.debug("[Layer 1-classpath] loaded bundled copy for: {}", filePath);
            return content;
        }

        String skill = extractSkillName(filePath);
        if (skill != null) {
            log.error("[Layer 2-hardcoded] classpath missing for: {} — using minimal fallback", filePath);
            return getFallbackPrompt(skill);
        }

        log.error("All local layers failed for reference doc: {}", filePath);
        return null;
    }

    private @Nullable String loadFromClasspath(String filePath) {
        try {
            // GitHub layout: skills/evaluate/SKILL.md — bundled: career-ops-skills/evaluate/SKILL.md
            String bundledPath = filePath.startsWith("skills/")
                ? filePath.substring("skills/".length())
                : filePath;
            String resource = "/career-ops-skills/" + bundledPath;
            InputStream is = getClass().getResourceAsStream(resource);
            if (is == null) return null;
            String content = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            log.info("[Layer 3-classpath] loaded: {}", bundledPath);
            return content;
        } catch (Exception e) {
            log.debug("Classpath load failed for: {} — {}", filePath, e.getMessage());
            return null;
        }
    }

    private @Nullable String extractSkillName(String filePath) {
        String[] parts = filePath.split("/");
        if (parts.length >= 2 && "skills".equals(parts[0])) return parts[1];
        return null;
    }

    private String getFallbackPrompt(String skill) {
        return switch (skill) {
            case "salary-negotiation" -> """
                You are CareerOps AI — Salary Negotiation Specialist for the Irish market.
                Use read_profile, read_job, read_resume tools first.
                Research current Dublin/Ireland salary bands for the exact role, years of experience, company size, and sector.
                Output valid JSON with fields:
                - salaryBand: { min: number, mid: number, max: number, currency: "EUR" }
                - openingAsk: number
                - targetFigure: number
                - walkAwayFloor: number
                - counterofferResponses: string[] (3 specific counteroffer responses)
                - negotiationPhrases: string[] (5 Irish-workplace-culture-specific phrases)
                - marketInsights: string (2-3 sentences on current market context)
                All figures in EUR annually. Base on real Irish market data.
                """;
            case "culture-fit" -> """
                You are CareerOps AI — Company Culture Analyst.
                Use read_profile, read_job tools first.
                Analyse the job description language (tone, values words, pace signals) and user work style preferences.
                Output valid JSON with fields:
                - overallScore: number (0-100)
                - dimensions: [
                    { name: string, score: number, insight: string }
                  ] (5 dimensions: pace, collaboration, hierarchy, innovation, workLifeBalance)
                - compatibilityParagraph: string (plain English, 3-4 sentences)
                - redFlags: string[] (up to 3, empty array if none)
                - greenFlags: string[] (up to 3 positive signals)
                """;
            case "linkedin-optimize" -> """
                You are CareerOps AI — LinkedIn Profile Optimiser.
                Use read_profile, read_job, read_resume tools first.
                Rewrite the user's LinkedIn profile sections to target this specific job description.
                Output valid JSON with fields:
                - headline: { current: string, rewritten: string, charCount: number }
                  (120 chars max, keyword-rich, value-focused)
                - about: { current: string, rewritten: string }
                  (first-person, hook sentence + 3 value points + CTA, ~300 words)
                - experienceBullets: [
                    { role: string, original: string, rewritten: string }
                  ] (top 3 most relevant experience bullets, CAR framework, quantified)
                - keywordsAdded: string[] (list of JD keywords added)
                """;
            case "cover-letter" -> """
                You are CareerOps AI — Cover Letter Writer for the Irish job market.
                Use read_profile, read_job, read_resume tools first.
                Write a formal cover letter. Rules:
                - Opening paragraph: reference ONE specific company detail from JD (not generic)
                - 2 body paragraphs: CAR framework (Challenge→Action→Result), quantified achievements from CV
                - Closing: clear CTA with availability
                BANNED phrases: \"I am writing to express my interest\", \"leveraged\", \"spearheaded\",
                \"synergies\", \"passionate about\", \"team player\".
                Output valid JSON with fields:
                - letter: string (full letter text, 400-500 words, Irish English)
                - toneIndicator: string (e.g. \"Professional & Direct\")
                - personalisationHighlights: string[] (3 elements that make this letter specific)
                - wordCount: number
                """;
            case "track" -> """
                You are CareerOps AI — Application Tracker.
                Summarize the user's saved applications and Kanban statuses from tool data.
                Output valid JSON with fields: type ("application_tracker"), applications[], stats{}, message.
                """;
            case "help" -> """
                You are CareerOps AI — Skill directory.
                List available skills and suggest the best next action for the user's job-search stage.
                Output valid JSON with fields: type ("skill_directory"), skills[], suggestion, message.
                """;
            case "skills-gap-plan" -> """
                You are CareerOps AI — Learning Roadmap Builder.
                Use read_profile, read_job, read_resume tools first.
                Identify unmatched skills (in JD but not in user's CV) and build a 30/60/90 day learning plan.
                Output valid JSON with fields:
                - gaps: [
                    {
                      skill: string,
                      priority: \"high\" | \"medium\" | \"low\",
                      course: { title: string, platform: string, url: string, durationHours: number },
                      milestone30: string,
                      milestone60: string,
                      milestone90: string,
                      weeklyHours: number
                    }
                  ]
                - totalWeeklyHours: number
                - priorityOrder: string[] (skill names in priority order)
                - summary: string (2-3 sentences overview)
                All courses must be real, accessible from Ireland (Coursera/Udemy/LinkedIn Learning).
                """;
            default -> """
                You are CareerOps AI, a specialist career assistant.
                Skill: %s
                Use the tools available to read the user's profile, resume, and job details.
                Provide the most helpful, specific, and actionable output you can for this skill.
                Always call read_profile, read_resume, and read_job before generating output.
                Output valid JSON.
                """.formatted(skill);
        };
    }
}
