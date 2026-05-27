package com.careerops.service;

import com.careerops.dto.SkillRunResponse;
import com.careerops.model.Job;
import com.careerops.model.SkillRun;
import com.careerops.model.UserJob;
import com.careerops.repository.JobRepository;
import com.careerops.repository.SkillRunRepository;
import com.careerops.repository.UserJobRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Non-AI catalog skills from career-ops-plugin: help (skill directory) and track (application stats).
 */
@Service
public class CatalogSkillService {

    public static final Set<String> CATALOG_SKILLS = Set.of("help", "track");

    private static final List<SkillEntry> DIRECTORY = List.of(
        new SkillEntry("evaluate", "Score a job against your CV (A–F + rubric)", "Evaluate this role"),
        new SkillEntry("tailor-resume", "ATS-optimized resume for a role", "Tailor my resume"),
        new SkillEntry("scan", "Search company career pages", "Scan {company} for jobs"),
        new SkillEntry("triage", "Quick-score your saved pipeline", "Triage my pipeline"),
        new SkillEntry("track", "View and update application tracker", "Show my applications"),
        new SkillEntry("apply", "Application form assistance", "Help me apply"),
        new SkillEntry("research", "Company research before interviews", "Research {company}"),
        new SkillEntry("outreach", "LinkedIn/email outreach drafts", "Draft outreach"),
        new SkillEntry("compare", "Compare saved opportunities", "Compare my top roles"),
        new SkillEntry("prep-interview", "Interview prep pack", "Prep interview for this role"),
        new SkillEntry("salary-negotiation", "Salary band and negotiation phrases", "Salary negotiation"),
        new SkillEntry("culture-fit", "Culture compatibility analysis", "Culture fit check"),
        new SkillEntry("linkedin-optimize", "LinkedIn profile for this JD", "Optimize LinkedIn"),
        new SkillEntry("cover-letter", "Cover letter for this role", "Write cover letter"),
        new SkillEntry("skills-gap-plan", "30/60/90 learning plan", "Skills gap plan"),
        new SkillEntry("help", "Skill directory and next-step hints", "What can you do?")
    );

    private final UserJobRepository userJobs;
    private final JobRepository jobs;
    private final SkillRunRepository skillRuns;
    private final CvService cvService;
    private final ObjectMapper mapper;

    public CatalogSkillService(
            UserJobRepository userJobs,
            JobRepository jobs,
            SkillRunRepository skillRuns,
            CvService cvService,
            ObjectMapper mapper) {
        this.userJobs = userJobs;
        this.jobs = jobs;
        this.skillRuns = skillRuns;
        this.cvService = cvService;
        this.mapper = mapper;
    }

    public boolean handles(String skillName) {
        return CATALOG_SKILLS.contains(skillName);
    }

    @Transactional(timeout = 10)
    public SkillRunResponse execute(String skillName, UUID userId, UUID userJobId) {
        JsonNode output = "track".equals(skillName)
            ? buildTrackOutput(userId)
            : buildHelpOutput(userId);
        persist(userId, userJobId, skillName, output);
        return SkillRunResponse.result(skillName, output);
    }

    private JsonNode buildHelpOutput(UUID userId) {
        ObjectNode out = mapper.createObjectNode();
        out.put("type", "skill_directory");
        ArrayNode skills = out.putArray("skills");
        for (SkillEntry e : DIRECTORY) {
            ObjectNode row = skills.addObject();
            row.put("name", e.name());
            row.put("description", e.description());
            row.put("trySaying", e.trySaying());
        }
        out.put("suggestion", suggestNextAction(userId));
        out.put("message", "Use the Careers dashboard Kanban and job detail pages for full tracker UX.");
        return out;
    }

    private JsonNode buildTrackOutput(UUID userId) {
        List<UserJob> rows = userJobs.findByUserIdOrderByDeliveredAtDesc(userId);
        ObjectNode out = mapper.createObjectNode();
        out.put("type", "application_tracker");
        ArrayNode applications = out.putArray("applications");
        int applied = 0;
        int interviewed = 0;
        int offers = 0;
        double scoreSum = 0;
        int scored = 0;

        for (UserJob uj : rows) {
            Job job = jobs.findById(uj.getJobId()).orElse(null);
            ObjectNode row = applications.addObject();
            row.put("userJobId", uj.getId().toString());
            row.put("status", uj.getStatus() != null ? uj.getStatus() : "Discovered");
            row.put("matchPercent", uj.getMatchPercent() != null ? uj.getMatchPercent() : 0);
            if (job != null) {
                row.put("company", job.getCompany());
                row.put("title", job.getTitle());
            }
            String status = row.path("status").asText("");
            if (status.toLowerCase().contains("applied")) applied++;
            if (status.toLowerCase().contains("interview")) interviewed++;
            if (status.toLowerCase().contains("offer")) offers++;
            if (uj.getScoreBreakdown() != null && uj.getScoreBreakdown().has("applyScore")) {
                scoreSum += uj.getScoreBreakdown().path("applyScore").asDouble();
                scored++;
            }
        }

        ObjectNode stats = out.putObject("stats");
        stats.put("total", rows.size());
        stats.put("applied", applied);
        stats.put("interviews", interviewed);
        stats.put("offers", offers);
        if (scored > 0) {
            stats.put("averageApplyScore", Math.round(scoreSum / scored * 10.0) / 10.0);
        }
        out.put("message", rows.isEmpty()
            ? "Your tracker is empty. Run onboarding delivery or fetch jobs from the dashboard."
            : "Showing " + rows.size() + " saved applications. Update status on the Kanban board.");
        return out;
    }

    private String suggestNextAction(UUID userId) {
        boolean hasCv = false;
        try {
            hasCv = cvService.hasActiveCv(userId);
        } catch (Exception ignored) {
            // optional
        }
        long jobCount = userJobs.countByUserId(userId);
        if (!hasCv) {
            return "Upload your CV in Settings, then run onboarding or evaluate a role.";
        }
        if (jobCount == 0) {
            return "Fetch jobs from the dashboard or paste a JD to evaluate a posting.";
        }
        if (jobCount < 3) {
            return "You have " + jobCount + " saved roles — fetch more matches or evaluate another posting.";
        }
        return "Open the Kanban board to update statuses, or run evaluate/tailor-resume on a top match.";
    }

    private void persist(UUID userId, UUID userJobId, String skill, JsonNode output) {
        SkillRun run = SkillRun.builder()
            .userId(userId)
            .userJobId(userJobId)
            .skill(skill)
            .output(output)
            .expiresAt(Instant.now().plusSeconds(3600))
            .build();
        skillRuns.save(run);
    }

    private record SkillEntry(String name, String description, String trySaying) {}
}
