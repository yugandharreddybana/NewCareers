package com.careerops.service;

import com.careerops.dto.SkillStartRequest;
import com.careerops.model.AgentResult;
import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.careerops.repository.JobRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Deterministic skill outputs when NVIDIA NIM is unavailable, rate-limited, or returns errors.
 * Ensures the UI receives structured JSON instead of HTTP 500.
 */
@Service
public class SkillLocalFallbackService {

    private static final Logger log = LoggerFactory.getLogger(SkillLocalFallbackService.class);

    private final ObjectMapper mapper;
    private final UserProfileRepository profiles;
    private final UserJobRepository userJobs;
    private final JobRepository jobs;
    private final CvService cvService;
    private final CvSkillExtractionService skillExtraction;
    private final JobMatchingService jobMatcher;
    private final EvaluationReportValidator evaluationValidator;
    private final StructuredJobEvaluationBuilder evaluationBuilder;
    private final TailorResumeBuilderService tailorResumeBuilder;
    private final TailorResumePendingStore tailorResumePending;

    public SkillLocalFallbackService(
            ObjectMapper mapper,
            UserProfileRepository profiles,
            UserJobRepository userJobs,
            JobRepository jobs,
            CvService cvService,
            CvSkillExtractionService skillExtraction,
            JobMatchingService jobMatcher,
            EvaluationReportValidator evaluationValidator,
            StructuredJobEvaluationBuilder evaluationBuilder,
            TailorResumeBuilderService tailorResumeBuilder,
            TailorResumePendingStore tailorResumePending) {
        this.mapper = mapper;
        this.profiles = profiles;
        this.userJobs = userJobs;
        this.jobs = jobs;
        this.cvService = cvService;
        this.skillExtraction = skillExtraction;
        this.jobMatcher = jobMatcher;
        this.evaluationValidator = evaluationValidator;
        this.evaluationBuilder = evaluationBuilder;
        this.tailorResumeBuilder = tailorResumeBuilder;
        this.tailorResumePending = tailorResumePending;
    }

    public Optional<AgentResult> tryFallback(String skill, UUID userId, UUID userJobId, SkillStartRequest req) {
        try {
            return switch (skill) {
                case "tailor-resume" -> Optional.of(tailorResume(userId, userJobId));
                case "evaluate" -> Optional.of(evaluate(userId, userJobId));
                case "cover-letter", "salary-negotiation", "culture-fit", "linkedin-optimize", "skills-gap-plan" ->
                    Optional.of(phase2Fallback(skill, userId, userJobId));
                case "research", "prep-interview", "apply", "outreach", "compare", "triage", "scan" ->
                    Optional.of(genericGuidance(skill, userId, userJobId));
                default -> Optional.empty();
            };
        } catch (Exception e) {
            log.warn("Local fallback failed for skill={}: {}", skill, e.getMessage());
            return Optional.empty();
        }
    }

    private AgentResult tailorResume(UUID userId, UUID userJobId) {
        Context ctx = loadContext(userId, userJobId);
        List<String> skills = skillExtraction.extractForUser(userId, ctx.profile(), ctx.cvText());
        String jobHay = jobHaystack(ctx.job());
        List<String> matched = skillExtraction.matchedInJob(skills, jobHay);
        List<String> unmatched = skillExtraction.unmatchedInJob(skills, jobHay);

        ObjectNode out = tailorResumeBuilder.build(
            userId, ctx.profile(), ctx.job(), ctx.cvText(), "local_fallback");
        out.put("atsScore", estimateAtsScore(matched.size(), Math.max(1, skills.size())));
        out.put("humanScore", Math.min(85, 55 + matched.size() * 4));

        ArrayNode warnings = mapper.createArrayNode();
        warnings.add("Generated without live AI — review and edit before applying. Set NVIDIA_API_KEY for full tailoring.");
        if (unmatched.size() > 3) {
            warnings.add("Consider addressing gaps: " + String.join(", ", unmatched.subList(0, Math.min(5, unmatched.size()))));
        }
        out.set("warnings", warnings);

        String html = out.path("resumeHtml").asText("");
        if (html.isBlank()) {
            html = buildResumeHtml(ctx, out.path("summary").asText(""), matched);
        }
        if (userJobId != null) {
            tailorResumePending.put(userId, userJobId, html, "local-fallback");
        }

        return AgentResult.done(out.toString());
    }

    private AgentResult evaluate(UUID userId, UUID userJobId) {
        Context ctx = loadContext(userId, userJobId);
        if (ctx.job() == null) {
            return AgentResult.error("No job context for evaluation.");
        }
        var ranked = jobMatcher.topN(List.of(ctx.job()), ctx.profile(), 1).stream().findFirst().orElse(null);
        JsonNode report = evaluationBuilder.build(
            userId,
            ctx.job(),
            ctx.profile(),
            ctx.cvText(),
            ranked,
            "local_fallback",
            "complete_local");
        return AgentResult.done(report.toString());
    }

    private AgentResult phase2Fallback(String skill, UUID userId, UUID userJobId) {
        Context ctx = loadContext(userId, userJobId);
        ObjectNode out = mapper.createObjectNode();
        out.put("mode", "local_fallback");
        out.put("skill", skill);
        out.put("message",
            "AI engine unavailable — draft below is template-based from your CV and this job. "
                + "Configure NVIDIA_API_KEY for full " + skill.replace('-', ' ') + " output.");

        switch (skill) {
            case "cover-letter" -> {
                String letter = buildCoverLetterDraft(ctx);
                out.put("letter", letter);
                out.put("wordCount", letter.split("\\s+").length);
                out.put("subject", "Application — " + safe(ctx.job() != null ? ctx.job().getTitle() : "Role"));
                ArrayNode highlights = mapper.createArrayNode();
                highlights.add("Uses your CV experience bullets");
                highlights.add("References " + safe(ctx.job() != null ? ctx.job().getCompany() : "the company"));
                out.set("personalisationHighlights", highlights);
            }
            case "skills-gap-plan" -> {
                List<String> skills = skillExtraction.extractForUser(userId, ctx.profile(), ctx.cvText());
                String jobHay = ctx.job() != null ? jobHaystack(ctx.job()) : "";
                List<String> gaps = skillExtraction.unmatchedInJob(skills, jobHay);
                ArrayNode gapArr = mapper.createArrayNode();
                gaps.forEach(gapArr::add);
                out.set("gaps", gapArr);
                out.put("plan", "Focus upskilling on: " + (gaps.isEmpty() ? "no major gaps detected" : String.join(", ", gaps)));
            }
            default -> out.put("guidance", "Re-run after configuring NVIDIA_API_KEY for personalised output.");
        }
        return AgentResult.done(out.toString());
    }

    private AgentResult genericGuidance(String skill, UUID userId, UUID userJobId) {
        Context ctx = loadContext(userId, userJobId);
        ObjectNode out = mapper.createObjectNode();
        out.put("mode", "local_fallback");
        out.put("skill", skill);
        out.put("summary",
            "Local guidance for " + skill.replace('-', ' ')
                + " — AI unavailable. Configure NVIDIA_API_KEY for full agent output.");
        if (ctx.job() != null) {
            out.put("jobTitle", ctx.job().getTitle());
            out.put("company", ctx.job().getCompany());
        }
        ArrayNode steps = mapper.createArrayNode();
        steps.add("Review the job description and highlight requirements you meet in your CV.");
        steps.add("Run Tailor my CV once AI is configured for ATS-optimised wording.");
        out.set("nextSteps", steps);
        return AgentResult.done(out.toString());
    }

    private String buildTailorSummary(Context ctx, List<String> matched) {
        String role = ctx.job() != null ? ctx.job().getTitle() : "this role";
        String company = ctx.job() != null ? ctx.job().getCompany() : "the company";
        String skillsLine = matched.isEmpty()
            ? "relevant experience from your CV"
            : String.join(", ", matched.subList(0, Math.min(6, matched.size())));
        return "Experienced professional targeting " + role + " at " + company + ". "
            + "Core strengths include " + skillsLine + ". "
            + "Ready to contribute measurable impact aligned to the role requirements.";
    }

    private String buildCoverLetterDraft(Context ctx) {
        String role = ctx.job() != null ? ctx.job().getTitle() : "the advertised role";
        String company = ctx.job() != null ? ctx.job().getCompany() : "your organisation";
        return "Dear Hiring Manager,\n\n"
            + "I am applying for the " + role + " position at " + company + ". "
            + "My background aligns with the requirements outlined in your posting, "
            + "and I am motivated to contribute from day one.\n\n"
            + "In recent roles I have delivered outcomes that map directly to your needs — "
            + "see my CV for quantified examples. "
            + "I would welcome the opportunity to discuss how my experience fits your team.\n\n"
            + "Kind regards";
    }

    private String buildResumeHtml(Context ctx, String summary, List<String> matched) {
        StringBuilder sb = new StringBuilder();
        sb.append("<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>CV</title>");
        sb.append("<style>body{font-family:Georgia,serif;max-width:720px;margin:2rem auto;line-height:1.5;color:#111}");
        sb.append("h1{font-size:1.4rem}h2{font-size:1rem;margin-top:1.25rem;border-bottom:1px solid #ccc}");
        sb.append(".skills{color:#065f46}</style></head><body>");
        if (ctx.profile() != null && ctx.profile().getTargetRoles() != null && ctx.profile().getTargetRoles().length > 0) {
            sb.append("<h1>").append(escape(ctx.profile().getTargetRoles()[0])).append("</h1>");
        }
        sb.append("<p><strong>Summary</strong><br/>").append(escape(summary)).append("</p>");
        if (!matched.isEmpty()) {
            sb.append("<h2>Key skills (ATS)</h2><p class=\"skills\">")
                .append(escape(String.join(" · ", matched)))
                .append("</p>");
        }
        if (ctx.cvText() != null && !ctx.cvText().isBlank()) {
            sb.append("<h2>Experience</h2><pre style=\"white-space:pre-wrap;font-family:inherit\">")
                .append(escape(truncate(ctx.cvText(), 4000)))
                .append("</pre>");
        }
        sb.append("</body></html>");
        return sb.toString();
    }

    private static int estimateAtsScore(int matched, int total) {
        if (total <= 0) return matched > 0 ? 70 : 55;
        return Math.min(92, 45 + (matched * 50 / total));
    }

    private Context loadContext(UUID userId, UUID userJobId) {
        UserProfile profile = profiles.findByUserId(userId).orElse(null);
        String cvText = "";
        try {
            cvText = cvService.activeCvText(userId);
        } catch (Exception ignored) {
            // no CV uploaded
        }
        Job job = null;
        if (userJobId != null) {
            job = userJobs.findById(userJobId)
                .flatMap(uj -> jobs.findById(uj.getJobId()))
                .orElse(null);
        }
        return new Context(profile, cvText, job);
    }

    private static String jobHaystack(Job job) {
        if (job == null) return "";
        return ((job.getTitle() == null ? "" : job.getTitle()) + " "
            + (job.getDescription() == null ? "" : job.getDescription())).toLowerCase();
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static String safe(String s) {
        return s == null || s.isBlank() ? "—" : s;
    }

    private record Context(UserProfile profile, String cvText, Job job) {}
}
