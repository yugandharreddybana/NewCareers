package com.careerops.service.skills.handlers;

import com.careerops.model.Job;
import com.careerops.model.UserJob;
import com.careerops.model.UserProfile;
import com.careerops.repository.JobRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.service.ClaudeDirectService;
import com.careerops.service.CvService;
import com.careerops.service.skills.SkillHandler;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.UUID;

/**
 * Task 28 — Cover Letter Skill Handler
 *
 * Generates a formal, personalised cover letter for the Irish job market.
 * Rules:
 *   - Opening paragraph references ONE specific company detail from JD (not generic)
 *   - 2 body paragraphs using CAR framework (Challenge → Action → Result)
 *   - Quantified achievements from the user's CV
 *   - Closing paragraph with clear CTA and availability
 *   - Banned phrases enforced
 * Output: full letter (400-500 words), tone indicator, 3 personalisation highlights, word count
 */
@Service
public class CoverLetterSkillHandler implements SkillHandler {

    private static final Logger log = LoggerFactory.getLogger(CoverLetterSkillHandler.class);

    private static final String SYSTEM_PROMPT = """
        You are a professional cover letter writer specialising in the Irish job market.
        You craft compelling, authentic, highly personalised cover letters that get candidates through the door.

        RULES (non-negotiable):
        1. Opening paragraph: reference ONE specific, concrete detail from the job description
           (a project, product, mission statement, team structure, or recent news) — never generic.
        2. Body paragraph 1: use the CAR framework (Challenge → Action → Result) with a specific
           achievement from the user's CV that directly maps to a key requirement in the JD.
           Must include a quantified result (%, €, number of users, team size, time saved).
        3. Body paragraph 2: second CAR example — different skill area, still from CV, still quantified.
        4. Closing paragraph: clear call-to-action, confirm availability, reference the role title
           and company name specifically. No waffle.
        5. Irish English spelling throughout (organisation, colour, recognised, etc.).
        6. First-person, direct, confident — not arrogant. Conversational-professional tone.
        7. Total length: 400–500 words. Count carefully.

        BANNED PHRASES (never use any of these, not even paraphrased versions):
        - "I am writing to express my interest"
        - "I am writing to apply"
        - "leveraged"
        - "spearheaded"
        - "synergies"
        - "passionate about"
        - "team player"
        - "results-driven"
        - "dynamic professional"
        - "I believe I would be a great fit"
        - "I am excited about the opportunity"
        - "Please find attached my CV"

        Return ONLY valid JSON (no markdown, no explanation outside JSON) with this exact structure:
        {
          "letter": "<full cover letter text, 400-500 words, paragraphs separated by \\n\\n>",
          "toneIndicator": "<e.g. Professional & Direct | Confident & Conversational | Formal & Precise>",
          "personalisationHighlights": [
            "<specific company detail referenced in opening>",
            "<achievement from CV used in paragraph 1>",
            "<achievement from CV used in paragraph 2>"
          ],
          "wordCount": <integer>,
          "subject": "<suggested email subject line for this application>"
        }
        """;

    private final ClaudeDirectService   claude;
    private final UserProfileRepository profiles;
    private final UserJobRepository     userJobs;
    private final JobRepository         jobs;
    private final CvService             cvService;
    private final ObjectMapper          mapper;

    public CoverLetterSkillHandler(
            ClaudeDirectService claude,
            UserProfileRepository profiles,
            UserJobRepository userJobs,
            JobRepository jobs,
            CvService cvService,
            ObjectMapper mapper) {
        this.claude   = claude;
        this.profiles = profiles;
        this.userJobs = userJobs;
        this.jobs     = jobs;
        this.cvService = cvService;
        this.mapper   = mapper;
    }

    @Override
    public String skillName() {
        return "cover-letter";
    }

    @Override
    public JsonNode execute(UUID userId, UUID userJobId) {
        log.info("CoverLetterSkillHandler.execute userId={} userJobId={}", userId, userJobId);

        UserProfile profile = profiles.findByUserId(userId).orElse(null);
        String cvText       = getCvText(userId);
        Job job             = resolveJob(userId, userJobId);

        String userPrompt = buildUserPrompt(profile, job, cvText);
        return claude.generateJson(SYSTEM_PROMPT, userPrompt, userId, skillName());
    }

    private String buildUserPrompt(UserProfile p, Job job, String cv) {
        StringBuilder sb = new StringBuilder();

        sb.append("## User Career Profile\n");
        if (p != null) {
            sb.append("Target roles: ").append(arr(p.getTargetRoles())).append("\n");
            sb.append("Tech stack: ").append(arr(p.getTechStack())).append("\n");
            sb.append("Location: ").append(p.getLocation()).append("\n");
            sb.append("Sectors: ").append(arr(p.getSectors())).append("\n");
        } else {
            sb.append("Profile not available.\n");
        }

        sb.append("\n## CV / Resume (source of achievements)\n");
        sb.append(cv != null && !cv.isBlank()
                ? trim(cv, 5000)
                : "CV not uploaded — generate best possible letter from job context only.");

        sb.append("\n\n## Job Description\n");
        if (job != null) {
            sb.append("Role title: ").append(job.getTitle()).append("\n");
            sb.append("Company: ").append(job.getCompany()).append("\n");
            sb.append("Location: ").append(job.getLocation()).append("\n");
            if (job.getSalaryMin() != null)
                sb.append("Salary: €").append(job.getSalaryMin())
                  .append(" - €").append(job.getSalaryMax()).append("\n");
            sb.append("\nFull job description:\n").append(trim(job.getDescription(), 4500));
        } else {
            sb.append("No specific job provided. Write a strong general cover letter ");
            sb.append("for the user's target role based on their profile.");
        }

        sb.append("\n\nGenerate the cover letter now. Follow ALL rules. ");
        sb.append("Ensure every paragraph references specific, verifiable details ");
        sb.append("from the CV and job description above.");
        return sb.toString();
    }

    private String getCvText(UUID userId) {
        try { return cvService.activeCvText(userId); } catch (Exception e) { return ""; }
    }

    private Job resolveJob(UUID userId, UUID userJobId) {
        if (userJobId == null) return null;
        return userJobs.findByIdAndUserId(userJobId, userId)
                .flatMap(uj -> jobs.findById(uj.getJobId()))
                .orElse(null);
    }

    private static String arr(String[] a) {
        return a == null ? "N/A" : Arrays.stream(a)
                .reduce((x, y) -> x + ", " + y).orElse("N/A");
    }

    private static String trim(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "...[truncated]";
    }
}
