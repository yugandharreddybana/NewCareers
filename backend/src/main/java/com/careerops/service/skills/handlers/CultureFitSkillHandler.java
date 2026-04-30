package com.careerops.service.skills.handlers;

import com.careerops.model.Job;
import com.careerops.model.UserJob;
import com.careerops.model.UserProfile;
import com.careerops.repository.JobRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.service.ClaudeDirectService;
import com.careerops.service.skills.SkillHandler;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.UUID;

/**
 * Task 26 — Culture Fit Skill Handler
 *
 * Analyses JD language (tone, values, pace signals) vs user work style preferences.
 * Output: culture fit score 0–100, 5 dimensions scored, compatibility paragraph,
 *         red flags, green flags.
 */
@Service
public class CultureFitSkillHandler implements SkillHandler {

    private static final Logger log = LoggerFactory.getLogger(CultureFitSkillHandler.class);

    private static final String SYSTEM_PROMPT = """
        You are a company culture analyst and organisational psychologist specialising in the Irish and European tech job market.
        You analyse job descriptions for hidden cultural signals and match them against candidate work-style preferences.

        You understand these culture signals in JDs:
        - Pace signals: "fast-paced", "scale quickly", "wear many hats" = high pace
        - Hierarchy signals: "flat structure", "autonomous", "report to CTO" vs "approval process", "governance"
        - Collaboration: "cross-functional", "pair programming" vs "individual contributor", "independent"
        - Innovation: "greenfield", "build from scratch" vs "maintain", "legacy systems"
        - Work-life: "flexible hours", "async-first" vs "on-call", "24/7", "deadline-driven"
        - Irish workplace specifics: strong work-life balance culture, direct but friendly communication, pub culture not mandatory

        You will receive the user's profile and the job description.

        Return ONLY valid JSON (no markdown) with this exact structure:
        {
          "overallScore": <number 0-100>,
          "scoreLabel": "<Excellent Fit | Good Fit | Moderate Fit | Poor Fit>",
          "dimensions": [
            { "name": "Work Pace",          "score": <0-100>, "userSignal": "<from profile>", "jdSignal": "<from JD>", "insight": "<1 sentence>" },
            { "name": "Collaboration Style", "score": <0-100>, "userSignal": "<from profile>", "jdSignal": "<from JD>", "insight": "<1 sentence>" },
            { "name": "Hierarchy & Autonomy","score": <0-100>, "userSignal": "<from profile>", "jdSignal": "<from JD>", "insight": "<1 sentence>" },
            { "name": "Innovation Appetite", "score": <0-100>, "userSignal": "<from profile>", "jdSignal": "<from JD>", "insight": "<1 sentence>" },
            { "name": "Work-Life Balance",   "score": <0-100>, "userSignal": "<from profile>", "jdSignal": "<from JD>", "insight": "<1 sentence>" }
          ],
          "compatibilityParagraph": "<3-4 sentence plain-English explanation of overall fit>",
          "redFlags": ["<flag 1 if any>", "<flag 2 if any>", "<flag 3 if any>"],
          "greenFlags": ["<positive signal 1>", "<positive signal 2>", "<positive signal 3>"]
        }

        Note: redFlags and greenFlags should be arrays — empty arrays [] if none found.
        Scores: 80-100 = strong alignment, 60-79 = good match, 40-59 = moderate, below 40 = poor fit.
        """;

    private final ClaudeDirectService   claude;
    private final UserProfileRepository profiles;
    private final UserJobRepository     userJobs;
    private final JobRepository         jobs;
    private final ObjectMapper          mapper;

    public CultureFitSkillHandler(
            ClaudeDirectService claude,
            UserProfileRepository profiles,
            UserJobRepository userJobs,
            JobRepository jobs,
            ObjectMapper mapper) {
        this.claude   = claude;
        this.profiles = profiles;
        this.userJobs = userJobs;
        this.jobs     = jobs;
        this.mapper   = mapper;
    }

    @Override
    public String skillName() { return "culture-fit"; }

    @Override
    public JsonNode execute(UUID userId, UUID userJobId) {
        log.info("CultureFitSkillHandler.execute userId={} userJobId={}", userId, userJobId);
        UserProfile profile = profiles.findByUserId(userId).orElse(null);
        Job job             = resolveJob(userJobId);
        return claude.generateJson(SYSTEM_PROMPT, buildUserPrompt(profile, job));
    }

    private String buildUserPrompt(UserProfile p, Job job) {
        StringBuilder sb = new StringBuilder();
        sb.append("## User Profile\n");
        if (p != null) {
            sb.append("Target roles: ").append(arr(p.getTargetRoles())).append("\n");
            sb.append("Preferred sectors: ").append(arr(p.getSectors())).append("\n");
            sb.append("Location preference: ").append(p.getLocation()).append("\n");
            sb.append("Open to sponsorship (indication of flexibility): ").append(p.getSponsorshipRequired()).append("\n");
        } else {
            sb.append("Profile not available — analyse JD signals only.\n");
        }

        sb.append("\n## Job Description\n");
        if (job != null) {
            sb.append("Title: ").append(job.getTitle()).append("\n");
            sb.append("Company: ").append(job.getCompany()).append("\n");
            sb.append("Location: ").append(job.getLocation()).append("\n");
            sb.append("\nFull description:\n").append(trim(job.getDescription(), 5000));
        } else {
            sb.append("No job description provided. Return a neutral analysis based on the user profile only.");
        }

        sb.append("\n\nAnalyse the cultural signals in the JD and score the fit against the user's profile.");
        return sb.toString();
    }

    private Job resolveJob(UUID userJobId) {
        if (userJobId == null) return null;
        return userJobs.findById(userJobId)
                .flatMap(uj -> jobs.findById(uj.getJobId()))
                .orElse(null);
    }

    private static String arr(String[] a) {
        return a == null ? "N/A" : Arrays.stream(a).reduce((x, y) -> x + ", " + y).orElse("N/A");
    }

    private static String trim(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "...[truncated]";
    }
}
