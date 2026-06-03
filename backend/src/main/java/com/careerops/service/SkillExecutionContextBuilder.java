package com.careerops.service;

import com.careerops.dto.SkillStartRequest;
import com.careerops.model.Job;
import com.careerops.model.SkillRun;
import com.careerops.model.UserJob;
import com.careerops.model.UserProfile;
import com.careerops.repository.JobRepository;
import com.careerops.repository.JobWatchlistRepository;
import com.careerops.repository.SkillRunRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Builds the USER message for SKILL.md execution — injects DB context that plugin skills
 * expect from {@code data/profile.yml}, {@code data/resume.md}, evaluations, etc.
 */
@Service
public class SkillExecutionContextBuilder {

    private static final int MAX_CV = 14_000;
    private static final int MAX_JD = 10_000;
    private static final int MAX_EVAL_SNIPPET = 4_000;

    private final UserProfileRepository profiles;
    private final UserJobRepository userJobs;
    private final JobRepository jobs;
    private final CvService cvService;
    private final SkillRunRepository skillRuns;
    private final JobWatchlistRepository watchlist;
    private final CompanyWebResearchService companyWebResearch;
    private final ObjectMapper mapper;

    public SkillExecutionContextBuilder(
            UserProfileRepository profiles,
            UserJobRepository userJobs,
            JobRepository jobs,
            CvService cvService,
            SkillRunRepository skillRuns,
            JobWatchlistRepository watchlist,
            CompanyWebResearchService companyWebResearch,
            ObjectMapper mapper) {
        this.profiles = profiles;
        this.userJobs = userJobs;
        this.jobs = jobs;
        this.cvService = cvService;
        this.skillRuns = skillRuns;
        this.watchlist = watchlist;
        this.companyWebResearch = companyWebResearch;
        this.mapper = mapper;
    }

    public String buildUserMessage(String skill, UUID userId, UUID userJobId, SkillStartRequest req) {
        StringBuilder sb = new StringBuilder();
        sb.append("# CareerOps skill run: ").append(skill).append("\n\n");
        sb.append("Execute every generative step from SKILL.md using the context below.\n");
        sb.append("All sections replace plugin file reads — do not ask for uploads or tool calls.\n\n");

        appendRequestOptions(sb, req);
        appendProfile(sb, userId);
        appendCv(sb, userId);
        appendJob(sb, userId, userJobId);

        switch (skill) {
            case "compare" -> appendCompareContext(sb, userId, req);
            case "triage", "scan" -> appendPipelineContext(sb, userId, req);
            case "apply", "outreach" -> appendPriorRuns(sb, userId, userJobId, List.of("evaluate", "research"));
            case "research" -> appendWebResearch(sb, userId, userJobId);
            default -> { }
        }

        sb.append("\n---\nGenerate the complete skill output now as JSON per the SaaS output contract.\n");
        return sb.toString();
    }

    private void appendRequestOptions(StringBuilder sb, SkillStartRequest req) {
        if (req == null) return;
        boolean any = false;
        StringBuilder opts = new StringBuilder("## Request options\n");
        if (req.channel() != null && !req.channel().isBlank()) {
            opts.append("- Channel: ").append(req.channel()).append("\n");
            any = true;
        }
        if (req.tone() != null && !req.tone().isBlank()) {
            opts.append("- Tone: ").append(req.tone()).append("\n");
            any = true;
        }
        if (req.step() != null && !req.step().isBlank()) {
            opts.append("- Step: ").append(req.step()).append("\n");
            any = true;
        }
        if (req.scanTarget() != null && !req.scanTarget().isBlank()) {
            opts.append("- Scan target: ").append(req.scanTarget()).append("\n");
            any = true;
        }
        if (req.compareJobIds() != null && !req.compareJobIds().isEmpty()) {
            opts.append("- Compare userJobIds: ")
                .append(String.join(", ", req.compareJobIds().stream().map(UUID::toString).toList()))
                .append("\n");
            any = true;
        }
        if (any) sb.append(opts).append("\n");
    }

    private void appendProfile(StringBuilder sb, UUID userId) {
        sb.append("## User Profile (data/profile.yml)\n");
        profiles.findByUserId(userId).ifPresentOrElse(p -> {
            sb.append("Target roles: ").append(arr(p.getTargetRoles())).append("\n");
            sb.append("Tech stack: ").append(arr(p.getTechStack())).append("\n");
            sb.append("Location: ").append(nullSafe(p.getLocation())).append("\n");
            sb.append("Sectors: ").append(arr(p.getSectors())).append("\n");
            sb.append("Experience level: ").append(nullSafe(p.getExperienceLevel())).append("\n");
            sb.append("Remote policy: ").append(nullSafe(p.getRemotePolicy())).append("\n");
            sb.append("Open to remote: ").append(p.getOpenToRemote() != null ? p.getOpenToRemote() : "—").append("\n");
            sb.append("Sponsorship required: ").append(p.getSponsorshipRequired() != null ? p.getSponsorshipRequired() : "—").append("\n");
            if (p.getSalaryMin() != null || p.getSalaryMax() != null) {
                sb.append("Salary target: €").append(p.getSalaryMin()).append(" – €").append(p.getSalaryMax()).append("\n");
            }
            if (p.getGoalTitle() != null && !p.getGoalTitle().isBlank()) {
                sb.append("Career goal: ").append(truncate(p.getGoalTitle(), 200)).append("\n");
            }
        }, () -> sb.append("Profile not available.\n"));
        sb.append("\n");
    }

    private void appendCv(StringBuilder sb, UUID userId) {
        sb.append("## CV / Resume (data/resume.md)\n");
        try {
            String cv = cvService.activeCvMarkdown(userId);
            if (cv == null || cv.isBlank()) cv = cvService.activeCvText(userId);
            sb.append(cv != null && !cv.isBlank() ? truncate(cv, MAX_CV) : "No CV uploaded.\n");
        } catch (Exception e) {
            sb.append("No CV uploaded.\n");
        }
        sb.append("\n\n");
    }

    private void appendJob(StringBuilder sb, UUID userId, UUID userJobId) {
        sb.append("## Target Job\n");
        Job job = resolveJob(userId, userJobId);
        if (job == null) {
            sb.append("No specific job selected.\n\n");
            return;
        }
        userJobs.findByIdAndUserId(userJobId, userId).ifPresent(uj -> {
            sb.append("UserJob ID: ").append(userJobId).append("\n");
            sb.append("Kanban column: ").append(nullSafe(uj.getKanbanColumn())).append("\n");
            sb.append("Match %: ").append(uj.getMatchPercent() != null ? uj.getMatchPercent() : "—").append("\n");
            sb.append("AI score: ").append(uj.getAiScore() != null ? uj.getAiScore() : "—").append("\n");
            if (uj.getHumanSummary() != null) {
                sb.append("Existing summary: ").append(truncate(uj.getHumanSummary(), 400)).append("\n");
            }
        });
        sb.append("Role title: ").append(nullSafe(job.getTitle())).append("\n");
        sb.append("Company: ").append(nullSafe(job.getCompany())).append("\n");
        sb.append("Location: ").append(nullSafe(job.getLocation())).append("\n");
        if (job.getSalaryMin() != null) {
            sb.append("Salary: €").append(job.getSalaryMin()).append(" – €").append(job.getSalaryMax()).append("\n");
        }
        sb.append("\nFull job description:\n").append(truncate(job.getDescription(), MAX_JD)).append("\n\n");
    }

    private void appendCompareContext(StringBuilder sb, UUID userId, SkillStartRequest req) {
        sb.append("## Prior evaluations (data/evaluations/)\n");
        List<UUID> ids = req != null && req.compareJobIds() != null && !req.compareJobIds().isEmpty()
            ? req.compareJobIds()
            : userJobs.findByUserIdOrderByDeliveredAtDesc(userId).stream()
                .limit(5)
                .map(UserJob::getId)
                .toList();

        if (ids.isEmpty()) {
            sb.append("No jobs available to compare.\n\n");
            return;
        }

        for (UUID ujId : ids) {
            appendEvaluationEntry(sb, userId, ujId);
        }
    }

    private void appendPipelineContext(StringBuilder sb, UUID userId, SkillStartRequest req) {
        sb.append("## Pipeline / watchlist (data/pipeline.md + config/portals.yml)\n");
        watchlist.findByUserIdOrderByCreatedAtDesc(userId).forEach(w ->
            sb.append("- Watchlist: ").append(nullSafe(w.getName()))
                .append(w.getQueryKeywords() != null ? " keywords=" + w.getQueryKeywords() : "")
                .append(w.getLocation() != null ? " location=" + w.getLocation() : "")
                .append("\n"));

        String scanFilter = req != null ? req.scanTarget() : null;
        List<UserJob> pipeline = userJobs.findByUserIdOrderByDeliveredAtDesc(userId).stream()
            .filter(uj -> scanFilter == null || scanFilter.isBlank()
                || "all".equalsIgnoreCase(scanFilter.trim())
                || matchesCompany(uj, scanFilter))
            .limit(20)
            .toList();

        if (pipeline.isEmpty()) {
            sb.append("No pipeline jobs found.\n\n");
            return;
        }

        for (UserJob uj : pipeline) {
            jobs.findById(uj.getJobId()).ifPresent(job -> {
                sb.append("\n### ").append(nullSafe(job.getCompany())).append(" — ").append(nullSafe(job.getTitle())).append("\n");
                sb.append("UserJob ID: ").append(uj.getId()).append("\n");
                sb.append("Status: ").append(nullSafe(uj.getKanbanColumn())).append("\n");
                sb.append("URL: ").append(nullSafe(job.getSourceUrl())).append("\n");
                sb.append(truncate(job.getDescription(), 1500)).append("\n");
            });
        }
        sb.append("\n");
    }

    private void appendWebResearch(StringBuilder sb, UUID userId, UUID userJobId) {
        Job job = resolveJob(userId, userJobId);
        if (job == null) return;
        String intel = companyWebResearch.fetchCompanyIntel(
            job.getCompany(), job.getTitle(), job.getLocation());
        sb.append("## Web research (auto-fetched — use for culture, news, pay, risks)\n");
        if (intel.isBlank()) {
            sb.append("Live web search unavailable. Infer cautiously from the job description and ")
                .append("your training knowledge of ").append(nullSafe(job.getCompany()))
                .append(" — mark uncertain claims in `limitations`.\n\n");
        } else {
            sb.append(intel).append("\n\n");
        }
    }

    private void appendPriorRuns(StringBuilder sb, UUID userId, UUID userJobId, List<String> skills) {
        if (userJobId == null) return;
        for (String prior : skills) {
            skillRuns.findFirstByUserIdAndUserJobIdAndSkillOrderByCreatedAtDesc(userId, userJobId, prior)
                .ifPresent(run -> {
                    sb.append("## Prior ").append(prior).append(" (data/")
                        .append(prior.equals("research") ? "research" : "evaluations")
                        .append("/)\n");
                    sb.append(truncate(run.getOutput().toString(), MAX_EVAL_SNIPPET)).append("\n\n");
                });
        }
    }

    private void appendEvaluationEntry(StringBuilder sb, UUID userId, UUID userJobId) {
        Job job = resolveJob(userId, userJobId);
        sb.append("\n### ");
        if (job != null) {
            sb.append(nullSafe(job.getCompany())).append(" — ").append(nullSafe(job.getTitle()));
        } else {
            sb.append("UserJob ").append(userJobId);
        }
        sb.append("\n");

        skillRuns.findFirstByUserIdAndUserJobIdAndSkillOrderByCreatedAtDesc(userId, userJobId, "evaluate")
            .ifPresentOrElse(run -> {
                JsonNode out = run.getOutput();
                sb.append("Score: ").append(out.path("applyScore").asDouble(out.path("overallScore").asDouble(0)))
                    .append("\n");
                sb.append("Verdict: ").append(out.path("verdict").asText("—")).append("\n");
                sb.append(truncate(out.toString(), MAX_EVAL_SNIPPET)).append("\n");
            }, () -> {
                userJobs.findByIdAndUserId(userJobId, userId).ifPresent(uj -> {
                    sb.append("Match %: ").append(uj.getMatchPercent()).append("\n");
                    sb.append("Summary: ").append(truncate(uj.getHumanSummary(), 500)).append("\n");
                });
            });
    }

    private Job resolveJob(UUID userId, UUID userJobId) {
        if (userJobId == null) return null;
        return userJobs.findByIdAndUserId(userJobId, userId)
            .flatMap(uj -> jobs.findById(uj.getJobId()))
            .orElse(null);
    }

    private static boolean matchesCompany(UserJob uj, String filter) {
        if (uj.getJob() == null) return false;
        String company = uj.getJob().getCompany();
        return company != null && company.toLowerCase(Locale.ROOT).contains(filter.toLowerCase(Locale.ROOT));
    }

    private static String arr(String[] a) {
        return a == null || a.length == 0 ? "N/A" : Arrays.stream(a).reduce((x, y) -> x + ", " + y).orElse("N/A");
    }

    private static String nullSafe(String s) {
        return s == null || s.isBlank() ? "—" : s;
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "…[truncated]";
    }
}
