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
 * Task 25 — Salary Negotiation Skill Handler
 *
 * Researches live Dublin/Ireland salary bands for the exact role + YOE + company size + sector.
 * Output: min/mid/max range (€), opening ask, target figure, walk-away floor,
 *         3 counteroffer responses, Irish-workplace negotiation phrases, market insights.
 */
@Service
public class SalaryNegotiationSkillHandler implements SkillHandler {

    private static final Logger log = LoggerFactory.getLogger(SalaryNegotiationSkillHandler.class);

    private static final String SYSTEM_PROMPT = """
        You are a senior career coach and salary negotiation expert specialising in the Irish job market (Dublin and Ireland).
        You have deep knowledge of:
        - Current salary bands across tech, finance, healthcare, and other sectors in Ireland (2024-2026)
        - Irish workplace culture: direct but polite negotiation style, emphasis on total compensation, pension contributions matter
        - Typical company structures in Ireland: multinationals (Google, Meta, Amazon, Salesforce), SMEs, startups, public sector
        - COLA trends in Ireland, contractor vs permanent rates, benefits packages typical in the Irish market

        You will receive the user's profile (target roles, YOE, tech stack, location, salary expectations)
        and the job description.

        IMPORTANT: Base all salary figures on real, current Irish market data.
        If the exact company/role combination is unclear, use sector benchmarks from IrishJobs, LinkedIn Salary Insights, and Glassdoor Ireland.

        Return ONLY valid JSON (no markdown, no explanation outside JSON) with this exact structure:
        {
          "salaryBand": {
            "min": <number in EUR annually>,
            "mid": <number>,
            "max": <number>,
            "currency": "EUR",
            "basis": "annual"
          },
          "openingAsk": <number — what to say first>,
          "targetFigure": <number — realistic target>,
          "walkAwayFloor": <number — absolute minimum to accept>,
          "counterofferResponses": [
            "<specific response to low offer>",
            "<specific response to 'that's our max'>",
            "<specific response to asking for time to consider>"
          ],
          "negotiationPhrases": [
            "<phrase 1 — Irish workplace tone>",
            "<phrase 2>",
            "<phrase 3>",
            "<phrase 4>",
            "<phrase 5>"
          ],
          "marketInsights": "<2-3 sentences on current Irish market context for this role>",
          "benefitsToNegotiate": ["<item 1>", "<item 2>", "<item 3>"],
          "timingAdvice": "<1-2 sentences on when and how to raise salary in Irish hiring process>"
        }
        """;

    private final ClaudeDirectService      claude;
    private final UserProfileRepository    profiles;
    private final UserJobRepository        userJobs;
    private final JobRepository            jobs;
    private final CvService                cvService;
    private final ObjectMapper             mapper;

    public SalaryNegotiationSkillHandler(
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
        return "salary-negotiation";
    }

    @Override
    public JsonNode execute(UUID userId, UUID userJobId) {
        log.info("SalaryNegotiationSkillHandler.execute userId={} userJobId={}", userId, userJobId);

        UserProfile profile = profiles.findByUserId(userId).orElse(null);
        String cvText       = getCvText(userId);
        Job job             = resolveJob(userJobId);

        String userPrompt = buildUserPrompt(profile, job, cvText);
        return claude.generateJson(SYSTEM_PROMPT, userPrompt);
    }

    private String buildUserPrompt(UserProfile p, Job job, String cv) {
        StringBuilder sb = new StringBuilder();
        sb.append("## User Career Profile\n");
        if (p != null) {
            sb.append("Target roles: ").append(arr(p.getTargetRoles())).append("\n");
            sb.append("Tech stack: ").append(arr(p.getTechStack())).append("\n");
            sb.append("Sectors: ").append(arr(p.getSectors())).append("\n");
            sb.append("Location: ").append(p.getLocation()).append("\n");
            sb.append("Current salary expectation (min): €").append(p.getSalaryMin()).append("\n");
            sb.append("Current salary expectation (max): €").append(p.getSalaryMax()).append("\n");
            sb.append("Sponsorship required: ").append(p.getSponsorshipRequired()).append("\n");
        } else {
            sb.append("Profile not available.\n");
        }

        sb.append("\n## CV Summary (first 3000 chars)\n");
        sb.append(cv != null && !cv.isBlank() ? trim(cv, 3000) : "CV not uploaded.");

        sb.append("\n\n## Job Description\n");
        if (job != null) {
            sb.append("Title: ").append(job.getTitle()).append("\n");
            sb.append("Company: ").append(job.getCompany()).append("\n");
            sb.append("Location: ").append(job.getLocation()).append("\n");
            sb.append("Advertised salary: €").append(job.getSalaryMin())
              .append(" - €").append(job.getSalaryMax()).append("\n");
            sb.append("Sponsorship: ").append(job.getSponsorship()).append("\n");
            sb.append("\nFull description:\n").append(trim(job.getDescription(), 4000));
        } else {
            sb.append("No specific job context provided. Use general Irish market data for the user's target roles.");
        }

        sb.append("\n\nBased on the above, research and provide the most accurate salary negotiation intelligence ");
        sb.append("for this specific combination of role, company, and Irish market conditions.");
        return sb.toString();
    }

    private String getCvText(UUID userId) {
        try { return cvService.activeCvText(userId); } catch (Exception e) { return ""; }
    }

    private Job resolveJob(UUID userJobId) {
        if (userJobId == null) return null;
        return userJobs.findById(userJobId)
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
