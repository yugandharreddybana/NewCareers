package com.careerops.service;

import com.careerops.exception.ApiException;
import com.careerops.model.*;
import com.careerops.repository.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Implementation of every visible skill button. Each method:
 *   1. Checks SkillRun cache — returns instantly if a run exists for this job+skill
 *   2. Loads skill prompt + user/job/CV context
 *   3. Calls Gemini
 *   4. Persists a SkillRun for caching/audit
 *   5. Returns structured JSON to the controller
 */
@Service
public class SkillService {

    private final SkillPromptLibrary   prompts;
    private final GeminiService        gemini;
    private final UserProfileRepository profiles;
    private final UserJobRepository    userJobs;
    private final JobRepository        jobs;
    private final SkillRunRepository   runs;
    private final CvService            cvService;
    private final ObjectMapper         mapper = new ObjectMapper();

    public SkillService(SkillPromptLibrary prompts, GeminiService gemini,
                        UserProfileRepository profiles, UserJobRepository userJobs,
                        JobRepository jobs, SkillRunRepository runs, CvService cv) {
        this.prompts = prompts; this.gemini = gemini;
        this.profiles = profiles; this.userJobs = userJobs;
        this.jobs = jobs; this.runs = runs; this.cvService = cv;
    }

    @Transactional
    public JsonNode evaluate(UUID userId, UUID userJobId) {
        JsonNode cached = getCached(userId, userJobId, "evaluate");
        if (cached != null) return cached;

        UserJob uj = ujOr404(userId, userJobId);
        Job job = jobs.findById(uj.getJobId()).orElseThrow();
        UserProfile p = profiles.findByUserId(userId).orElseThrow();
        String cv = cvService.activeCvText(userId);
        String user = buildEvalPrompt(p, job, cv);
        return persistAndReturn(userId, userJobId, "evaluate",
            mapper.createObjectNode().put("user", user),
            gemini.generateJson(prompts.prompt("evaluate"), user));
    }

    @Transactional
    public JsonNode tailorResume(UUID userId, UUID userJobId) {
        JsonNode cached = getCached(userId, userJobId, "tailor-resume");
        if (cached != null) return cached;

        UserJob uj = ujOr404(userId, userJobId);
        Job job = jobs.findById(uj.getJobId()).orElseThrow();
        String cv = cvService.activeCvText(userId);
        String user = String.format("""
            ORIGINAL CV:
            %s

            TARGET JOB:
            Title: %s @ %s
            Description:
            %s
            """, trim(cv, 8000), job.getTitle(), job.getCompany(), trim(job.getDescription(), 8000));
        return persistAndReturn(userId, userJobId, "tailor-resume",
            mapper.createObjectNode().put("input", "cv+jd"),
            gemini.generateJson(prompts.prompt("tailor-resume"), user));
    }

    @Transactional
    public JsonNode researchCompany(UUID userId, UUID userJobId) {
        JsonNode cached = getCached(userId, userJobId, "research");
        if (cached != null) return cached;

        UserJob uj = ujOr404(userId, userJobId);
        Job job = jobs.findById(uj.getJobId()).orElseThrow();
        String user = "COMPANY: " + job.getCompany() + "\nROLE: " + job.getTitle()
            + "\nLOCATION: " + job.getLocation();
        return persistAndReturn(userId, userJobId, "research",
            mapper.createObjectNode().put("company", job.getCompany()),
            gemini.generateJson(prompts.prompt("research"), user));
    }

    @Transactional
    public JsonNode draftOutreach(UUID userId, UUID userJobId, String channel, String tone) {
        // Outreach is channel+tone-specific — use composite cache key
        String skillKey = "outreach-" + channel + "-" + tone;
        JsonNode cached = getCached(userId, userJobId, skillKey);
        if (cached != null) return cached;

        UserJob uj = ujOr404(userId, userJobId);
        Job job = jobs.findById(uj.getJobId()).orElseThrow();
        UserProfile p = profiles.findByUserId(userId).orElseThrow();
        String user = String.format("""
            CHANNEL: %s
            TONE: %s
            CANDIDATE: roles=%s, stack=%s
            ROLE: %s @ %s — %s
            """, channel, tone, arr(p.getTargetRoles()), arr(p.getTechStack()),
            job.getTitle(), job.getCompany(), job.getLocation());
        return persistAndReturn(userId, userJobId, skillKey,
            mapper.createObjectNode().put("channel", channel),
            gemini.generateJson(prompts.prompt("outreach"), user));
    }

    @Transactional
    public JsonNode applyAssistant(UUID userId, UUID userJobId, String step) {
        String skillKey = "apply-" + (step == null ? "all" : step);
        JsonNode cached = getCached(userId, userJobId, skillKey);
        if (cached != null) return cached;

        UserJob uj = ujOr404(userId, userJobId);
        Job job = jobs.findById(uj.getJobId()).orElseThrow();
        String cv = cvService.activeCvText(userId);
        String user = String.format("""
            STEP: %s
            JOB: %s @ %s
            DESCRIPTION:
            %s

            CV:
            %s
            """, step == null ? "all" : step, job.getTitle(), job.getCompany(),
            trim(job.getDescription(), 6000), trim(cv, 6000));
        return persistAndReturn(userId, userJobId, skillKey,
            mapper.createObjectNode().put("step", step),
            gemini.generateJson(prompts.prompt("apply"), user));
    }

    @Transactional
    public JsonNode prepInterview(UUID userId, UUID userJobId) {
        JsonNode cached = getCached(userId, userJobId, "prep-interview");
        if (cached != null) return cached;

        UserJob uj = ujOr404(userId, userJobId);
        Job job = jobs.findById(uj.getJobId()).orElseThrow();
        UserProfile p = profiles.findByUserId(userId).orElseThrow();
        String user = "Prepare interview kit for " + job.getTitle() + " @ " + job.getCompany()
            + ".\nCandidate stack: " + arr(p.getTechStack())
            + "\nJD:\n" + trim(job.getDescription(), 6000);
        return persistAndReturn(userId, userJobId, "prep-interview",
            mapper.createObjectNode().put("kind", "kit"),
            gemini.generateJson(prompts.prompt("prep-interview"), user));
    }

    @Transactional
    public JsonNode compare(UUID userId, List<UUID> userJobIds) {
        if (userJobIds == null || userJobIds.size() < 2)
            throw new ApiException(HttpStatus.BAD_REQUEST, "Select at least 2 jobs");
        StringBuilder sb = new StringBuilder("Compare these jobs for the candidate:\n\n");
        int n = 1;
        for (UUID id : userJobIds) {
            UserJob uj = ujOr404(userId, id);
            Job j = jobs.findById(uj.getJobId()).orElseThrow();
            sb.append("Job ").append(n++).append(": ").append(j.getTitle()).append(" @ ").append(j.getCompany())
              .append(" | Match: ").append(uj.getMatchPercent()).append("%")
              .append(" | Salary: ").append(j.getSalaryMin()).append("-").append(j.getSalaryMax())
              .append(" | Location: ").append(j.getLocation()).append("\n")
              .append(trim(j.getDescription(), 1500)).append("\n\n");
        }
        // compare is always fresh (different job combos)
        return persistAndReturn(userId, null, "compare",
            mapper.createObjectNode().put("count", userJobIds.size()),
            gemini.generateJson(prompts.prompt("compare"), sb.toString()));
    }

    @Transactional
    public JsonNode triage(UUID userId) {
        var all = userJobs.findByUserIdOrderByDeliveredAtDesc(userId);
        if (all.isEmpty()) return mapper.createObjectNode().put("ranked", "[]");
        StringBuilder sb = new StringBuilder("Re-rank these jobs and give a one-line verdict each:\n\n");
        for (UserJob uj : all) {
            Job j = jobs.findById(uj.getJobId()).orElse(null);
            if (j == null) continue;
            sb.append("- id=").append(uj.getId())
              .append(" | ").append(j.getTitle()).append(" @ ").append(j.getCompany())
              .append(" | match=").append(uj.getMatchPercent()).append("\n");
        }
        // triage is always fresh (queue may have changed)
        return persistAndReturn(userId, null, "triage",
            mapper.createObjectNode().put("count", all.size()),
            gemini.generateJson(prompts.prompt("triage"), sb.toString()));
    }

    @Transactional(readOnly = true)
    public JsonNode lastRun(UUID userId, UUID userJobId, String skill) {
        return runs.findFirstByUserIdAndUserJobIdAndSkillOrderByCreatedAtDesc(userId, userJobId, skill)
            .map(SkillRun::getOutput).orElse(null);
    }

    /* ---------- helpers ---------- */

    /**
     * Returns the most recent cached output for a skill, or null if not cached.
     * Prevents duplicate Gemini calls when the user re-opens the same skill panel.
     */
    private JsonNode getCached(UUID userId, UUID userJobId, String skill) {
        if (userJobId == null) return null;
        return runs.findFirstByUserIdAndUserJobIdAndSkillOrderByCreatedAtDesc(userId, userJobId, skill)
            .map(SkillRun::getOutput)
            .orElse(null);
    }

    private UserJob ujOr404(UUID userId, UUID userJobId) {
        return userJobs.findByIdAndUserId(userJobId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User-job not found"));
    }

    private JsonNode persistAndReturn(UUID userId, UUID userJobId, String skill, JsonNode input, JsonNode output) {
        runs.save(SkillRun.builder()
            .userId(userId).userJobId(userJobId).skill(skill)
            .input(input).output(output).build());
        return output;
    }

    private String buildEvalPrompt(UserProfile p, Job job, String cv) {
        return String.format("""
            USER PROFILE:
            - Target roles: %s
            - Tech stack: %s
            - Sectors: %s
            - Location: %s
            - Salary: %s-%s
            - Sponsorship required: %s
            - Min match: %s%%

            CV:
            %s

            JOB:
            Title: %s | Company: %s | Location: %s
            Salary: %s-%s | Sponsorship: %s
            Description:
            %s
            """,
            arr(p.getTargetRoles()), arr(p.getTechStack()), arr(p.getSectors()),
            p.getLocation(), p.getSalaryMin(), p.getSalaryMax(),
            p.getSponsorshipRequired(), p.getMinMatchPercent(),
            trim(cv, 8000),
            job.getTitle(), job.getCompany(), job.getLocation(),
            job.getSalaryMin(), job.getSalaryMax(), job.getSponsorship(),
            trim(job.getDescription(), 8000)
        );
    }

    private static String trim(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "...[truncated]";
    }

    private static String arr(String[] a) {
        return a == null ? "[]" : Arrays.stream(a).collect(Collectors.joining(", ", "[", "]"));
    }
}
