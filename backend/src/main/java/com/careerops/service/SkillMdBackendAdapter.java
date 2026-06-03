package com.careerops.service;

import java.util.Map;

/**
 * Maps bundled career-ops-skills SKILL.md plugin semantics to CareerOps SaaS API execution.
 * Appended to {@link SkillPromptLibrary#buildFullSystemPrompt(String, java.util.UUID)} for every skill run.
 */
final class SkillMdBackendAdapter {

    private SkillMdBackendAdapter() {}

    static String executionBlockFor(String skill) {
        StringBuilder sb = new StringBuilder("""
            ---
            ## BACKEND EXECUTION (CareerOps API — follow SKILL.md strictly)

            You are running inside the CareerOps SaaS backend (not Claude Code with Read/Write/Glob tools).

            **Context mapping (replaces file reads):**
            - `data/profile.yml` → **User Profile** section in the USER message
            - `data/resume.md` → **CV / Resume** section in the USER message
            - Job posting / evaluation → **Target Job** section (when provided)
            - `data/evaluations/` → **Prior evaluations** section (when provided)
            - `data/research/{company}.md` → **Prior research** section (when provided)
            - `data/pipeline.md` / scan results → **Pipeline / watchlist** section (when provided)
            - `data/applications.md` → **Application tracker** section (when provided)

            **Do NOT:** ask the user to upload files, invoke read_profile/read_resume/read_job tools,
            or write to `data/` paths — the server persists JSON results.

            **Skip in API mode:** Steps that only save markdown to disk, update `data/applications.md`,
            or offer computer-use form filling unless the USER message explicitly requests a revision.

            **Non-negotiable:** Execute every analytical/generative step in SKILL.md (scoring, narratives,
            recommendations, drafts). Use ONLY facts from the provided profile and CV — never invent employers,
            dates, degrees, or metrics.

            """);

        sb.append(SKIP_STEPS.getOrDefault(skill, ""));
        sb.append("\n\n");
        sb.append(saasOutputContract(skill));
        return sb.toString();
    }

    private static final Map<String, String> SKIP_STEPS = Map.ofEntries(
        Map.entry("tailor-resume", """
            **Tailor-resume API skips:** PDF how-to, applications tracker update, next-step suggestions.
            The server renders ATS HTML from your JSON — do not return raw HTML in JSON.
            """),
        Map.entry("evaluate", """
            **Evaluate API skips:** writing evaluation markdown to `data/evaluations/` and applications tracker rows.
            Return the EvaluationReportV2 JSON contract below instead.
            """),
        Map.entry("research", """
            **Research API skips:** saving `data/research/{company}.md`. Return structured JSON instead.
            Do NOT ask the user questions — auto-complete from job description + **Web research** section.
            Include culture, recent news, compensation signals, and risk flags. Note gaps in `limitations` only.
            """),
        Map.entry("scan", """
            **Scan API skips:** updating scan-history and pipeline files.
            WebSearch is unavailable — score openings from the **Pipeline / watchlist** section provided.
            If no listings are provided, return `openings: []` and explain in `message`.
            """),
        Map.entry("apply", """
            **Apply API skips:** computer-use form filling and tracker updates.
            Return all generated answers as JSON for user review — never imply auto-submit.
            """),
        Map.entry("outreach", """
            **Outreach API skips:** saving draft files. Return JSON messages for each contact/format.
            WebSearch is unavailable — use job + profile + any prior research provided.
            """),
        Map.entry("compare", """
            **Compare API skips:** reading markdown evaluation files — use **Prior evaluations** JSON injected below.
            """),
        Map.entry("triage", """
            **Triage API skips:** pipeline file writes. Score jobs from the **Pipeline** section provided.
            """)
    );

    static String saasOutputContract(String skill) {
        return SAAS_CONTRACTS.getOrDefault(skill, DEFAULT_CONTRACT.formatted(skill));
    }

    private static final String DEFAULT_CONTRACT = """
        **Output:** Return ONLY valid JSON (no markdown fences, no prose outside JSON).
        Mirror the skill's intended deliverables as JSON fields. Skill: %s
        """;

    private static final Map<String, String> SAAS_CONTRACTS = Map.ofEntries(
        Map.entry("evaluate", """
            **Output:** Return ONLY valid JSON matching EvaluationReportV2 (see SaaS output contract in SKILL.md above).
            Include schemaVersion: 2, all 10 dimension keys, sections A–F, matchedSkills, unmatchedSkills (gaps in JD not in CV).
            """),
        Map.entry("research", """
            **Output:** Return ONLY valid JSON:
            { "company": string, "summary": string,
              "culture": { "overview": string, "workStyle": string, "positiveThemes": string[], "negativeThemes": string[] },
              "recentNews": [{ "headline": string, "summary": string, "dateHint": string }],
              "compensation": { "signals": string, "salaryBandHint": string, "currency": "EUR" },
              "riskFlags": string[],
              "contacts": [{ "name": string, "title": string, "source": string }],
              "interviewIntelligence": { "values": string, "priorities": string, "questionsToAsk": string[] },
              "limitations": string }
            Never ask the user for input. Use web research + job description.
            """),
        Map.entry("prep-interview", """
            **Output:** Return ONLY valid JSON:
            { "personalQuestions": [{ "question": string, "idealAnswer": string, "assessing": string }],
              "easyTechnical": [...], "mediumTechnical": [...], "hardTechnical": [...],
              "codingQuestions": [{ "question": string, "hint": string, "assessing": string }],
              "questionsToExpect": [...], "topicsToStudy": string[], "summary": string }
            Each question array: min 5 items (coding min 3).
            """),
        Map.entry("apply", """
            **Output:** Return ONLY valid JSON:
            { "company": string, "role": string, "coverLetter": string, "whyCompany": string, "whyRole": string,
              "salaryExpectations": string, "standardFields": { "name": string, "email": string, ... },
              "customAnswers": [{ "question": string, "answer": string }],
              "reviewMessage": string }
            """),
        Map.entry("outreach", """
            **Output:** Return ONLY valid JSON:
            { "company": string, "contacts": [{ "name": string, "title": string, "platform": string,
              "message": string, "characterCount": number, "tone": string }],
              "variationsOffered": string[] }
            LinkedIn connection requests must be under 300 characters.
            """),
        Map.entry("compare", """
            **Output:** Return ONLY valid JSON:
            { "comparisonTable": [{ "dimension": string, "values": string[] }],
              "opportunities": [{ "company": string, "role": string, "score": number, "pros": string[], "cons": string[] }],
              "recommendation": { "bestOverall": string, "bestGrowth": string, "safestOption": string, "narrative": string } }
            """),
        Map.entry("triage", """
            **Output:** Return ONLY valid JSON:
            { "ranked": [{ "company": string, "role": string, "quickScore": number, "titleFit": number,
              "locationFit": number, "skillsFit": number, "recommendation": "evaluate"|"skip"|"maybe", "rationale": string }],
              "summary": string, "evaluateNext": string[] }
            """),
        Map.entry("scan", """
            **Output:** Return ONLY valid JSON:
            { "openings": [{ "company": string, "title": string, "location": string, "url": string, "matchHint": string }],
              "warnings": string[], "message": string }
            """),
        Map.entry("cover-letter", """
            **Output:** Return ONLY valid JSON:
            { "letter": string, "toneIndicator": string, "personalisationHighlights": string[],
              "wordCount": number, "subject": string }
            400–500 words, Irish English, banned phrases per SKILL.md.
            """),
        Map.entry("culture-fit", """
            **Output:** Return ONLY valid JSON:
            { "overallScore": number, "dimensions": [{ "name": string, "score": number, "insight": string }],
              "compatibilityParagraph": string, "redFlags": string[], "greenFlags": string[] }
            """),
        Map.entry("salary-negotiation", """
            **Output:** Return ONLY valid JSON:
            { "salaryBand": { "min": number, "mid": number, "max": number, "currency": "EUR" },
              "openingAsk": number, "targetFigure": number, "walkAwayFloor": number,
              "counterofferResponses": string[], "negotiationPhrases": string[], "marketInsights": string }
            """),
        Map.entry("linkedin-optimize", """
            **Output:** Return ONLY valid JSON:
            { "headline": { "current": string, "rewritten": string, "charCount": number },
              "about": { "current": string, "rewritten": string },
              "experienceBullets": [{ "role": string, "original": string, "rewritten": string }],
              "keywordsAdded": string[] }
            """),
        Map.entry("skills-gap-plan", """
            **Output:** Return ONLY valid JSON:
            { "gaps": [{ "skill": string, "priority": "high"|"medium"|"low",
              "course": { "title": string, "platform": string, "url": string, "durationHours": number },
              "milestone30": string, "milestone60": string, "milestone90": string, "weeklyHours": number }],
              "totalWeeklyHours": number, "priorityOrder": string[], "summary": string }
            """)
    );
}
