package com.careerops.service.skills.handlers;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.careerops.repository.JobRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.service.NvidiaService;
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
 * AI engine migrated from ClaudeDirectService to NvidiaService.
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
        - Irish workplace specifics: strong work-life balance culture, direct but friendly communication

        Return ONLY valid JSON (no markdown) with this exact structure:
        {
          "overallScore": <number 0-100>,
          "scoreLabel": "<Excellent Fit | Good Fit | Moderate Fit | Poor Fit>",
          "dimensions": [
            { "name": "Work Pace",           "score": <0-100>, "userSignal": "<from profile>", "jdSignal": "<from JD>", "insight": "<1 sentence>" },
            { "name": "Collaboration Style",  "score": <0-100>, "userSignal": "<from profile>", "jdSignal": "<from JD>", "insight": "<1 sentence>" },
            { "name": "Hierarchy & Autonomy", "score": <0-100>, "userSignal": "<from profile>", "jdSignal": "<from JD>", "insight": "<1 sentence>" },
            { "name": "Innovation Appetite",  "score": <0-100>, "userSignal": "<from profile>", "jdSignal": "<from JD>", "insight": "<1 sentence>" },
            { "name": "Work-Life Balance",    "score": <0-100>, "userSignal": "<from profile>", "jdSignal": "<from JD>", "insight": "<1 sentence>" }
          ],
          "compatibilityParagraph": "<3-4 sentence plain-English explanation of overall fit>",
          "redFlags": ["<flag 1 if any>"],
          "greenFlags": ["<positive signal 1>"]
        }

        Scores: 80-100 = strong alignment, 60-79 = good match, 40-59 = moderate, below 40 = poor fit.
        """;

    private final NvidiaService         nvidia;
    private final UserProfileRepository profiles;
    private final UserJobRepository     userJobs;
    private final JobRepository         jobs;
    private final ObjectMapper          mapper;

    public CultureFitSkillHandler(
            NvidiaService nvidia,
            UserProfileRepository profiles,
            UserJobRepository userJobs,
            JobRepository jobs,
            ObjectMapper mapper) {
        this.nvidia   = nvidia;
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
        Job job             = resolveJob(userId, userJobId);
        return nvidia.generateJson(SYSTEM_PROMPT, buildUserPrompt(profile, job), userId, skillName());
    }

    private String buildUserPrompt(UserProfile p, Job job) {
        StringBuilder sb = new StringBuilder();
        sb.append("## User Profile\n");
        if (p != null) {
            sb.append("Target roles: ").append(arr(p.getTargetRoles())).append("\n");
            sb.append("Preferred sectors: ").append(arr(p.getSectors())).append("\n");
            sb.append("Location preference: ").append(p.getLocation()).append("\n");
            sb.append("Open to sponsorship: ").append(p.getSponsorshipRequired()).append("\n");
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
            sb.append("No job description provided.");
        }
        sb.append("\n\nAnalyse the cultural signals in the JD and score the fit against the user's profile.");
        return sb.toString();
    }

    private Job resolveJob(UUID userId, UUID userJobId) {
        if (userJobId == null) return null;
        return userJobs.findByIdAndUserId(userJobId, userId)
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
