package com.careerops.service.skills.handlers;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.careerops.repository.JobRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.service.NvidiaService;
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
 * Task 29 — Skills Gap Plan Skill Handler
 *
 * Identifies unmatched skills (required by JD but absent from CV) and builds
 * a structured 30/60/90-day learning roadmap with real courses accessible from Ireland.
 *
 * Output: per-skill gap entry with course, milestones, weekly hours;
 *         total weekly commitment, priority order, summary.
 */
@Service
public class SkillsGapPlanSkillHandler implements SkillHandler {

    private static final Logger log = LoggerFactory.getLogger(SkillsGapPlanSkillHandler.class);

    private static final String SYSTEM_PROMPT = """
        You are a career development coach and learning strategist with deep expertise in
        the Irish tech job market. You build precise, actionable learning roadmaps.

        Your task:
        1. Compare the job description requirements against the user's CV and profile skills.
        2. Identify skill GAPS — skills mentioned in the JD that are absent or underdeveloped in the CV.
        3. For each gap, build a realistic 30/60/90-day learning plan.

        COURSE RULES:
        - Every course must be REAL and verifiable (not invented).
        - Use courses from: Coursera, Udemy, LinkedIn Learning, Pluralsight, freeCodeCamp, edX.
        - All courses must be accessible from Ireland (no geo-blocked content).
        - Include the real course URL or platform search path.
        - Prefer courses updated in 2023-2025.

        MILESTONE RULES:
        - Milestone Day 30: foundational understanding — can describe the concept.
        - Milestone Day 60: applied knowledge — has completed 1 project or exercise.
        - Milestone Day 90: interview-ready — can confidently discuss and demonstrate.

        PRIORITY RULES:
        - high: explicitly required in JD, critical for the role
        - medium: mentioned in JD, nice to have or secondary skill
        - low: inferred from JD context, future-proofing

        Return ONLY valid JSON (no markdown, no text outside JSON) with this exact structure:
        {
          \"gaps\": [
            {
              \"skill\": \"<skill name>\",
              \"priority\": \"high\" | \"medium\" | \"low\",
              \"reason\": \"<1 sentence: why this is a gap based on JD vs CV>\",
              \"course\": {
                \"title\": \"<exact course title>\",
                \"platform\": \"Coursera\" | \"Udemy\" | \"LinkedIn Learning\" | \"Pluralsight\" | \"freeCodeCamp\" | \"edX\" | \"YouTube\",
                \"url\": \"<full URL or search path>\",
                \"durationHours\": <number>,
                \"level\": \"Beginner\" | \"Intermediate\" | \"Advanced\"
              },
              \"milestone30\": \"<specific, measurable outcome by day 30>\",
              \"milestone60\": \"<specific, measurable outcome by day 60>\",
              \"milestone90\": \"<specific, measurable outcome by day 90>\",
              \"weeklyHours\": <number — realistic weekly time commitment>
            }
          ],
          \"totalWeeklyHours\": <sum of all weeklyHours>,
          \"priorityOrder\": [\"<skill name in priority order from highest to lowest>\"],
          \"summary\": \"<2-3 sentence overview of the gaps and overall learning journey>\",
          \"estimatedReadyDate\": \"<e.g. 'Interview-ready in 90 days' or specific milestone>\"
        }

        If the user's CV covers all major JD requirements, return:
        {
          \"gaps\": [],
          \"totalWeeklyHours\": 0,
          \"priorityOrder\": [],
          \"summary\": \"Your CV is a strong match for this role. No critical skill gaps identified.\",
          \"estimatedReadyDate\": \"Ready now\"
        }
        """;

    private final NvidiaService         nvidia;
    private final UserProfileRepository profiles;
    private final UserJobRepository     userJobs;
    private final JobRepository         jobs;
    private final CvService             cvService;
    private final ObjectMapper          mapper;

    public SkillsGapPlanSkillHandler(
            NvidiaService nvidia,
            UserProfileRepository profiles,
            UserJobRepository userJobs,
            JobRepository jobs,
            CvService cvService,
            ObjectMapper mapper) {
        this.nvidia   = nvidia;
        this.profiles = profiles;
        this.userJobs = userJobs;
        this.jobs     = jobs;
        this.cvService = cvService;
        this.mapper   = mapper;
    }

    @Override
    public String skillName() {
        return "skills-gap-plan";
    }

    @Override
    public JsonNode execute(UUID userId, UUID userJobId) {
        log.info("SkillsGapPlanSkillHandler.execute userId={} userJobId={}", userId, userJobId);

        UserProfile profile = profiles.findByUserId(userId).orElse(null);
        String cvText       = getCvText(userId);
        Job job             = resolveJob(userId, userJobId);

        String userPrompt = buildUserPrompt(profile, job, cvText);
        return nvidia.generateJson(SYSTEM_PROMPT, userPrompt, userId, skillName());
    }

    private String buildUserPrompt(UserProfile p, Job job, String cv) {
        StringBuilder sb = new StringBuilder();

        sb.append("## User Career Profile\n");
        if (p != null) {
            sb.append("Target roles: ").append(arr(p.getTargetRoles())).append("\n");
            sb.append("Current tech stack: ").append(arr(p.getTechStack())).append("\n");
            sb.append("Sectors: ").append(arr(p.getSectors())).append("\n");
            sb.append("Location: ").append(p.getLocation()).append("\n");
        } else {
            sb.append("Profile not available.\n");
        }

        sb.append("\n## User CV (skills evidence)\n");
        sb.append(cv != null && !cv.isBlank()
                ? trim(cv, 5000)
                : "CV not uploaded — identify gaps based on profile tech stack only.");

        sb.append("\n\n## Target Job Description\n");
        if (job != null) {
            sb.append("Role: ").append(job.getTitle()).append("\n");
            sb.append("Company: ").append(job.getCompany()).append("\n");
            sb.append("Location: ").append(job.getLocation()).append("\n");
            sb.append("\nFull job description:\n").append(trim(job.getDescription(), 4500));
        } else {
            sb.append("No specific job provided. Identify general skill gaps ");
            sb.append("based on the user's target roles and current tech stack.");
        }

        sb.append("\n\nAnalyse the gap between what the job requires and what the user's CV demonstrates. ");
        sb.append("Be specific, actionable, and use only real courses accessible from Ireland.");
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
