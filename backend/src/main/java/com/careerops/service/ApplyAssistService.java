package com.careerops.service;

import com.careerops.dto.ApplyQuestionResponse;
import com.careerops.exception.ApiException;
import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.careerops.repository.JobRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.UUID;

/**
 * Answers individual employer application-form questions using CV + profile context.
 */
@Service
public class ApplyAssistService {

    private final UserJobRepository userJobs;
    private final JobRepository jobs;
    private final UserProfileRepository profiles;
    private final CvService cvService;
    private final NvidiaService nvidia;
    private final SkillPromptLibrary prompts;
    private final SkillExecutionContextBuilder contextBuilder;

    public ApplyAssistService(
            UserJobRepository userJobs,
            JobRepository jobs,
            UserProfileRepository profiles,
            CvService cvService,
            NvidiaService nvidia,
            SkillPromptLibrary prompts,
            SkillExecutionContextBuilder contextBuilder) {
        this.userJobs = userJobs;
        this.jobs = jobs;
        this.profiles = profiles;
        this.cvService = cvService;
        this.nvidia = nvidia;
        this.prompts = prompts;
        this.contextBuilder = contextBuilder;
    }

    public ApplyQuestionResponse answerQuestion(UUID userId, UUID userJobId, String question, boolean rerun) {
        var uj = userJobs.findByIdAndUserId(userJobId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Job not found"));
        Job job = jobs.findById(uj.getJobId())
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Job missing"));
        UserProfile profile = profiles.findByUserId(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Complete your profile first"));

        String cv = cvService.activeCvText(userId);
        if (cv == null || cv.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Upload a CV before using Apply Assistant");
        }

        String roleLabel = inferRoleLabel(job, profile);
        String system = prompts.buildBackendSkillSystemPrompt("apply", userId)
            + """

            ## Apply Assistant (single-question API)
            Follow apply SKILL.md rules for custom questions. Return ONLY the answer text — no JSON, no headings.
            Never auto-submit. Use ONLY facts from the CV and profile.
            """;
        String userPrompt = contextBuilder.buildUserMessage("apply", userId, userJobId, null)
            + "\n\n## Employer question\n"
            + question.trim()
            + "\n\n"
            + (rerun
                ? "Write a fresh alternative answer with different structure (still truthful). Plain text only."
                : "Write the best honest answer for this form field. Plain text only.");

        String answer;
        try {
            answer = nvidia.generatePlainText(system, userPrompt, userId, "apply-assist-question");
        } catch (Exception e) {
            answer = null;
        }
        if (answer == null || answer.isBlank()) {
            answer = localAnswer(roleLabel, job, question, cv);
        }
        if (answer == null || answer.isBlank()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Could not generate an answer");
        }
        return new ApplyQuestionResponse(answer.trim());
    }

    static String inferRoleLabel(Job job, UserProfile profile) {
        String title = job.getTitle() == null ? "" : job.getTitle().toLowerCase(Locale.ROOT);
        String haystack = title + "\n" + (job.getDescription() == null ? "" : job.getDescription()).toLowerCase(Locale.ROOT);
        if (haystack.contains("full stack") || haystack.contains("fullstack")) {
            return "Full-stack engineer";
        }
        if (haystack.contains("backend") || haystack.contains("java") || haystack.contains("spring")) {
            return "Backend engineer";
        }
        if (haystack.contains("frontend") || haystack.contains("ui engineer")) {
            return "Frontend engineer";
        }
        if (haystack.contains("react") && !haystack.contains("full stack") && !haystack.contains("fullstack")) {
            return "Frontend engineer";
        }
        if (haystack.contains("devops") || haystack.contains("sre") || haystack.contains("platform")) {
            return "Platform / DevOps engineer";
        }
        if (haystack.contains("data")) {
            return "Data engineer";
        }
        if (profile.getTargetRoles() != null && profile.getTargetRoles().length > 0) {
            String target = profile.getTargetRoles()[0];
            if (!conflictsWithJob(target, haystack)) {
                return target;
            }
        }
        return job.getTitle() != null && !job.getTitle().isBlank() ? job.getTitle() : "Software engineer";
    }

    private static boolean conflictsWithJob(String targetRole, String jobHaystack) {
        String t = targetRole.toLowerCase(Locale.ROOT);
        boolean jobBackend = jobHaystack.contains("backend") || jobHaystack.contains("java");
        boolean jobFrontend = jobHaystack.contains("frontend") || jobHaystack.contains("react");
        if (jobBackend && t.contains("front")) return true;
        if (jobFrontend && t.contains("back")) return true;
        return false;
    }

    private static String localAnswer(String roleLabel, Job job, String question, String cv) {
        String snippet = cv.lines()
            .filter(l -> l.length() > 20)
            .limit(3)
            .reduce((a, b) -> a + " " + b)
            .orElse("my recent delivery work");
        return "As a " + roleLabel + " applying to " + safe(job.getTitle()) + " at " + safe(job.getCompany())
            + ", I would answer as follows. " + question + "\n\n"
            + "In my experience, " + snippet.trim()
            + " I focus on measurable outcomes, clear communication under pressure, and aligning with "
            + safe(job.getCompany()) + "'s expectations for this role. (AI engine offline — refine this draft.)";
    }

    private static String safe(String s) {
        return s == null || s.isBlank() ? "—" : s;
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }
}
