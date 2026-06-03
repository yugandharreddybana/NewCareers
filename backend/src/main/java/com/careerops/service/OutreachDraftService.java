package com.careerops.service;

import com.careerops.exception.ApiException;
import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.careerops.repository.JobRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Structured outreach drafts: top two contacts and messages in every common format.
 */
@Service
public class OutreachDraftService {

    private final UserJobRepository userJobs;
    private final JobRepository jobs;
    private final UserProfileRepository profiles;
    private final CvService cvService;
    private final CvSkillExtractionService skillExtraction;
    private final NvidiaService nvidia;
    private final ObjectMapper mapper;
    private final SkillPromptLibrary prompts;
    private final SkillExecutionContextBuilder contextBuilder;

    public OutreachDraftService(
            UserJobRepository userJobs,
            JobRepository jobs,
            UserProfileRepository profiles,
            CvService cvService,
            CvSkillExtractionService skillExtraction,
            NvidiaService nvidia,
            ObjectMapper mapper,
            SkillPromptLibrary prompts,
            SkillExecutionContextBuilder contextBuilder) {
        this.userJobs = userJobs;
        this.jobs = jobs;
        this.profiles = profiles;
        this.cvService = cvService;
        this.skillExtraction = skillExtraction;
        this.nvidia = nvidia;
        this.mapper = mapper;
        this.prompts = prompts;
        this.contextBuilder = contextBuilder;
    }

    public ObjectNode buildDraft(UUID userId, UUID userJobId, String channel, String tone) {
        var uj = userJobs.findByIdAndUserId(userJobId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Job not found"));
        Job job = jobs.findById(uj.getJobId())
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Job missing"));
        UserProfile profile = profiles.findByUserId(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Complete your profile first"));

        String cv = cvService.activeCvText(userId);
        List<String> matched = skillExtraction.matchedInJob(
            skillExtraction.extractForUser(userId, profile, cv),
            jobHaystack(job));

        List<ContactPick> contacts = pickTopContacts(job, profile);
        ObjectNode root = mapper.createObjectNode();
        root.put("channel", channel != null ? channel : "linkedin");
        root.put("tone", tone != null ? tone : "professional");
        root.put("company", safe(job.getCompany()));
        root.put("roleTitle", safe(job.getTitle()));

        ArrayNode contactArr = root.putArray("contacts");
        for (ContactPick c : contacts) {
            ObjectNode contact = contactArr.addObject();
            contact.put("name", c.name());
            contact.put("title", c.title());
            contact.put("whyThisPerson", c.rationale());
            contact.put("priority", c.priority());

            ObjectNode formats = contact.putObject("formats");
            String proof = proofLine(profile, matched);
            formats.put("linkedInConnection",
                truncate(linkedInConnection(job, c, proof), 280));
            formats.put("linkedInMessage",
                linkedInMessage(job, c, proof, tone));
            formats.put("coldEmailSubject",
                emailSubject(job, c));
            formats.put("coldEmailBody",
                emailBody(job, c, proof, tone));
            formats.put("followUp",
                followUp(job, c, tone));
        }

        // Legacy single-message fields (first contact primary format)
        if (!contacts.isEmpty()) {
            ContactPick primary = contacts.get(0);
            root.put("subject", emailSubject(job, primary));
            root.put("body", linkedInMessage(job, primary, proofLine(profile, matched), tone));
            root.put("rationale", primary.rationale());
        }

        tryEnhanceWithAi(userId, userJobId, root);
        return root;
    }

    private void tryEnhanceWithAi(UUID userId, UUID userJobId, ObjectNode root) {
        try {
            String channel = root.path("channel").asText("linkedin");
            String tone = root.path("tone").asText("professional");
            var req = new com.careerops.dto.SkillStartRequest(
                "outreach", userJobId, channel, tone, null, null, null, null);
            String system = prompts.buildBackendSkillSystemPrompt("outreach", userId)
                + """

                ## Outreach draft API
                Return JSON with exactly two contacts. Each contact needs formats:
                linkedInConnection (under 280 chars), linkedInMessage, coldEmailSubject, coldEmailBody, followUp.
                Preserve company and roleTitle from the draft when valid.
                """;
            String user = contextBuilder.buildUserMessage("outreach", userId, userJobId, req)
                + "\n\n## Deterministic draft to refine\n" + root;
            var improved = nvidia.generateJson(system, user, userId, "outreach-draft");
            if (improved != null && improved.isObject() && improved.has("contacts")) {
                root.removeAll();
                improved.fields().forEachRemaining(e -> root.set(e.getKey(), e.getValue()));
            }
        } catch (Exception ignored) {
            // keep deterministic draft
        }
    }

    private record ContactPick(String name, String title, String rationale, int priority) {}

    private List<ContactPick> pickTopContacts(Job job, UserProfile profile) {
        String company = safe(job.getCompany());
        String role = safe(job.getTitle());
        List<ContactPick> picks = new ArrayList<>();
        picks.add(new ContactPick(
            "Hiring manager — " + role,
            "Hiring Manager / Engineering Lead",
            "Owns the requisition for " + role + " at " + company
                + " — highest leverage for fit and timeline.",
            1));
        picks.add(new ContactPick(
            "Talent partner — " + company,
            "Recruiter / Talent Acquisition",
            "Screens applications and schedules interviews; best for process questions and referrals.",
            2));
        return picks;
    }

    private static String teamHint(String role) {
        String lower = role.toLowerCase(Locale.ROOT);
        if (lower.contains("backend") || lower.contains("java")) return "backend/platform";
        if (lower.contains("front") || lower.contains("react")) return "product engineering";
        if (lower.contains("data")) return "data";
        return "hiring";
    }

    private static String proofLine(UserProfile profile, List<String> matched) {
        if (!matched.isEmpty()) {
            return "In my recent work I've delivered outcomes with "
                + String.join(", ", matched.stream().limit(4).toList()) + ".";
        }
        if (profile.getTargetRoles() != null && profile.getTargetRoles().length > 0) {
            return "My background as a " + profile.getTargetRoles()[0] + " aligns with what you're hiring for.";
        }
        return "My CV shows relevant delivery experience for this type of role.";
    }

    private static String linkedInConnection(Job job, ContactPick c, String proof) {
        return "Hi — I applied for " + safe(job.getTitle()) + " at " + safe(job.getCompany())
            + ". " + proof + " Would value connecting.";
    }

    private static String linkedInMessage(Job job, ContactPick c, String proof, String tone) {
        return "Hi,\n\nI'm interested in the " + safe(job.getTitle()) + " role at " + safe(job.getCompany())
            + ". " + proof + "\n\n"
            + "I'd welcome a brief conversation about how I can contribute to your team.\n\nBest regards";
    }

    private static String emailSubject(Job job, ContactPick c) {
        return "Application follow-up — " + safe(job.getTitle()) + " · " + safe(job.getCompany());
    }

    private static String emailBody(Job job, ContactPick c, String proof, String tone) {
        return "Dear " + c.title() + ",\n\n"
            + "I recently applied for the " + safe(job.getTitle()) + " position at " + safe(job.getCompany()) + ". "
            + proof + "\n\n"
            + "I would appreciate the chance to discuss how my experience maps to your team's needs.\n\n"
            + "Kind regards";
    }

    private static String followUp(Job job, ContactPick c, String tone) {
        return "Hi — following up on my note about the " + safe(job.getTitle())
            + " role. Still very interested in " + safe(job.getCompany())
            + " and happy to share more detail on relevant projects.";
    }

    private static String jobHaystack(Job job) {
        return ((job.getTitle() == null ? "" : job.getTitle()) + "\n"
            + (job.getDescription() == null ? "" : job.getDescription())).toLowerCase(Locale.ROOT);
    }

    private static String safe(String s) {
        return s == null || s.isBlank() ? "—" : s;
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }
}
