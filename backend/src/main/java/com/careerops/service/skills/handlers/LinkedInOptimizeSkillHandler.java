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
 * Task 27 — LinkedIn Optimize Skill Handler
 *
 * Rewrites user's LinkedIn sections to target the specific JD:
 *   - Headline (120 chars, keyword-rich, value-focused, before/after)
 *   - About section (first-person, hook + 3 value points + CTA, ~300 words, before/after)
 *   - Top 3 experience bullet rewrites (CAR framework, quantified, mirrors JD keywords)
 * Output: structured before/after per section, keywords added list.
 */
@Service
public class LinkedInOptimizeSkillHandler implements SkillHandler {

    private static final Logger log = LoggerFactory.getLogger(LinkedInOptimizeSkillHandler.class);

    private static final String SYSTEM_PROMPT = """
        You are a LinkedIn profile optimisation expert specialising in the Irish and European tech market.
        You write compelling, keyword-rich LinkedIn profiles that rank well in recruiter searches
        and immediately communicate a candidate's unique value.

        Rules:
        - Headline: MAX 120 characters, must include job title keyword + specialisation + value statement
        - About: First-person voice. Start with a hook (NOT "I am a..."). Include 3 clear value points.
          End with a call-to-action ("Currently open to..."). ~300 words.
        - Experience bullets: Use CAR framework (Challenge → Action → Result).
          Every bullet must be quantified (€, %, headcount, time saved).
          Mirror exact keywords from the JD naturally.
        - Irish English spelling throughout (organisation, optimise, colour, etc.)
        - BANNED phrases: "leveraged", "spearheaded", "passionate about", "team player",
          "results-driven", "dynamic professional", "thought leader"

        You will receive the user's CV (which contains their current experience) and the target JD.
        Infer their "current" LinkedIn sections from their CV.

        Return ONLY valid JSON (no markdown) with this exact structure:
        {
          "headline": {
            "current": "<inferred from CV/profile or 'Not provided'>",
            "rewritten": "<new headline, MAX 120 chars>",
            "charCount": <number>,
            "keywordsAdded": ["<keyword 1>", "<keyword 2>"]
          },
          "about": {
            "current": "<inferred from CV summary section or 'Not provided'>",
            "rewritten": "<full about section, ~300 words, first-person>",
            "wordCount": <number>
          },
          "experienceBullets": [
            {
              "role": "<job title at company>",
              "original": "<existing bullet from CV>",
              "rewritten": "<CAR-framework quantified rewrite>"
            },
            {
              "role": "<job title at company>",
              "original": "<existing bullet>",
              "rewritten": "<CAR rewrite>"
            },
            {
              "role": "<job title at company>",
              "original": "<existing bullet>",
              "rewritten": "<CAR rewrite>"
            }
          ],
          "keywordsAdded": ["<all JD keywords woven into the profile>"],
          "optimisationScore": <number 0-100, how well the new profile targets the JD>
        }
        """;

    private final ClaudeDirectService   claude;
    private final UserProfileRepository profiles;
    private final UserJobRepository     userJobs;
    private final JobRepository         jobs;
    private final CvService             cvService;
    private final ObjectMapper          mapper;

    public LinkedInOptimizeSkillHandler(
            ClaudeDirectService claude,
            UserProfileRepository profiles,
            UserJobRepository userJobs,
            JobRepository jobs,
            CvService cvService,
            ObjectMapper mapper) {
        this.claude    = claude;
        this.profiles  = profiles;
        this.userJobs  = userJobs;
        this.jobs      = jobs;
        this.cvService = cvService;
        this.mapper    = mapper;
    }

    @Override
    public String skillName() { return "linkedin-optimize"; }

    @Override
    public JsonNode execute(UUID userId, UUID userJobId) {
        log.info("LinkedInOptimizeSkillHandler.execute userId={} userJobId={}", userId, userJobId);
        UserProfile profile = profiles.findByUserId(userId).orElse(null);
        String cvText       = getCvText(userId);
        Job job             = resolveJob(userJobId);
        return claude.generateJson(SYSTEM_PROMPT, buildUserPrompt(profile, job, cvText));
    }

    private String buildUserPrompt(UserProfile p, Job job, String cv) {
        StringBuilder sb = new StringBuilder();
        sb.append("## User Profile\n");
        if (p != null) {
            sb.append("Name (if available): use from CV\n");
            sb.append("Target roles: ").append(arr(p.getTargetRoles())).append("\n");
            sb.append("Tech stack: ").append(arr(p.getTechStack())).append("\n");
            sb.append("Sectors: ").append(arr(p.getSectors())).append("\n");
            sb.append("Location: ").append(p.getLocation()).append("\n");
        }

        sb.append("\n## Full CV / Resume\n");
        sb.append(cv != null && !cv.isBlank() ? trim(cv, 4000)
                : "CV not uploaded. Infer profile from available data.");

        sb.append("\n\n## Target Job Description\n");
        if (job != null) {
            sb.append("Title: ").append(job.getTitle()).append("\n");
            sb.append("Company: ").append(job.getCompany()).append("\n");
            sb.append("Location: ").append(job.getLocation()).append("\n");
            sb.append("\nFull JD:\n").append(trim(job.getDescription(), 4000));
        } else {
            sb.append("No specific job provided. Optimise for the user's target roles generally.");
        }

        sb.append("\n\nRewrite the LinkedIn profile sections to perfectly target this role. ");
        sb.append("Infer current sections from the CV provided.");
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
        return a == null ? "N/A" : Arrays.stream(a).reduce((x, y) -> x + ", " + y).orElse("N/A");
    }

    private static String trim(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "...[truncated]";
    }
}
