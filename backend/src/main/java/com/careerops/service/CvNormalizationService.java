package com.careerops.service;

import com.careerops.model.UserCv;
import com.careerops.model.UserProfile;
import com.careerops.repository.UserCvRepository;
import com.careerops.repository.UserProfileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Converts uploaded CV text + profile work history into Career-Ops style markdown (cv.md).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CvNormalizationService {

    private static final String SYSTEM_PROMPT = """
        You convert résumé content into a single markdown document suitable for AI job matching.
        Use Irish/UK English. Use ## headings: Summary, Experience, Skills, Education.
        Experience bullets use CAR format (Challenge → Action → Result) where possible.
        Do not invent employers or dates not present in the input. Output markdown only, no code fences.
        """;

    private final NvidiaService nvidia;
    private final UserCvRepository cvRepo;
    private final UserProfileRepository profiles;
    private final UserJobSkillMatchService skillMatchService;

    @Value("${nvidia.api.key:}")
    private String nvidiaApiKey;

    @Transactional
    public String normalizeAndStore(UUID userId) {
        UserCv cv = cvRepo.findFirstByUserIdAndIsActiveTrueOrderByUploadedAtDesc(userId)
            .orElseThrow(() -> com.careerops.exception.ApiException.badRequest("Upload your CV before continuing"));
        UserProfile profile = profiles.findByUserId(userId).orElse(null);

        String parsed = cv.getParsedText() != null ? cv.getParsedText().trim() : "";
        if (parsed.isBlank()) {
            throw com.careerops.exception.ApiException.badRequest("Could not read text from your CV file");
        }

        String markdown;
        if (nvidiaApiKey != null && !nvidiaApiKey.isBlank()) {
            try {
                String userPrompt = buildUserPrompt(parsed, profile);
                markdown = nvidia.generatePlainText(SYSTEM_PROMPT, userPrompt, userId, "cv-normalize");
            } catch (Exception e) {
                log.warn("AI CV normalization failed for userId={}, using deterministic fallback: {}", userId, e.getMessage());
                markdown = buildDeterministicMarkdown(parsed, profile);
            }
        } else {
            markdown = buildDeterministicMarkdown(parsed, profile);
        }

        markdown = markdown.trim();
        if (markdown.isBlank()) {
            markdown = buildDeterministicMarkdown(parsed, profile);
        }

        cv.setCvMarkdown(markdown);
        cvRepo.save(cv);
        try {
            skillMatchService.refreshAllForUser(userId);
        } catch (Exception e) {
            log.warn("Could not refresh pipeline skill matches after CV normalize userId={}: {}", userId, e.getMessage());
        }
        log.info("Stored cv_markdown for userId={} ({} chars)", userId, markdown.length());
        return markdown;
    }

    private String buildUserPrompt(String parsed, UserProfile profile) {
        StringBuilder sb = new StringBuilder();
        sb.append("RAW CV TEXT:\n").append(truncate(parsed, 12_000)).append("\n\n");
        if (profile != null) {
            appendProfileContext(sb, profile);
        }
        return sb.toString();
    }

    private static void appendProfileContext(StringBuilder sb, UserProfile profile) {
        if (profile.getGoalTitle() != null && !profile.getGoalTitle().isBlank()) {
            sb.append("HEADLINE: ").append(profile.getGoalTitle()).append("\n");
        }
        if (profile.getLocation() != null) {
            sb.append("LOCATION: ").append(profile.getLocation()).append("\n");
        }
        if (profile.getTargetRoles() != null && profile.getTargetRoles().length > 0) {
            sb.append("TARGET ROLES: ").append(String.join(", ", profile.getTargetRoles())).append("\n");
        }
        if (profile.getTechStack() != null && profile.getTechStack().length > 0) {
            sb.append("TECH: ").append(String.join(", ", profile.getTechStack())).append("\n");
        }
        if (profile.getWorkExperience() != null && !profile.getWorkExperience().isEmpty()) {
            sb.append("\nSTRUCTURED WORK (from onboarding):\n");
            profile.getWorkExperience().forEach(w -> {
                sb.append("- ").append(nullSafe(w.getJobTitle())).append(" @ ")
                    .append(nullSafe(w.getCompanyName()));
                if (w.getStartDate() != null || w.getEndDate() != null) {
                    sb.append(" (").append(nullSafe(w.getStartDate())).append(" – ")
                        .append(w.isCurrent() ? "Present" : nullSafe(w.getEndDate())).append(")");
                }
                sb.append("\n");
                if (w.getDescription() != null && !w.getDescription().isBlank()) {
                    sb.append("  ").append(w.getDescription().replace("\n", "\n  ")).append("\n");
                }
            });
        }
        if (profile.getEducation() != null && !profile.getEducation().isEmpty()) {
            sb.append("\nEDUCATION:\n");
            profile.getEducation().forEach(e ->
                sb.append("- ").append(nullSafe(e.getDegree())).append(", ")
                    .append(nullSafe(e.getSchoolName()))
                    .append(e.getGraduationYear() != null ? " (" + e.getGraduationYear() + ")" : "")
                    .append("\n"));
        }
    }

    static String buildDeterministicMarkdown(String parsed, UserProfile profile) {
        StringBuilder md = new StringBuilder();
        md.append("# CV\n\n");
        if (profile != null && profile.getGoalTitle() != null && !profile.getGoalTitle().isBlank()) {
            md.append("## Summary\n\n").append(profile.getGoalTitle().trim()).append("\n\n");
        } else {
            md.append("## Summary\n\n").append(firstParagraph(parsed)).append("\n\n");
        }
        if (profile != null && profile.getWorkExperience() != null && !profile.getWorkExperience().isEmpty()) {
            md.append("## Experience\n\n");
            profile.getWorkExperience().forEach(w -> {
                md.append("### ").append(nullSafe(w.getJobTitle())).append(" — ")
                    .append(nullSafe(w.getCompanyName())).append("\n");
                if (w.getStartDate() != null || w.getEndDate() != null) {
                    md.append("*").append(nullSafe(w.getStartDate())).append(" – ")
                        .append(w.isCurrent() ? "Present" : nullSafe(w.getEndDate())).append("*\n\n");
                }
                if (w.getDescription() != null && !w.getDescription().isBlank()) {
                    md.append(w.getDescription().trim()).append("\n\n");
                }
            });
        } else {
            md.append("## Experience\n\n").append(truncate(parsed, 8000)).append("\n\n");
        }
        if (profile != null && profile.getTechStack() != null && profile.getTechStack().length > 0) {
            md.append("## Skills\n\n").append(String.join(", ", profile.getTechStack())).append("\n\n");
        }
        if (profile != null && profile.getEducation() != null && !profile.getEducation().isEmpty()) {
            md.append("## Education\n\n");
            profile.getEducation().forEach(e ->
                md.append("- **").append(nullSafe(e.getDegree())).append("**, ")
                    .append(nullSafe(e.getSchoolName()))
                    .append(e.getGraduationYear() != null ? " (" + e.getGraduationYear() + ")" : "")
                    .append("\n"));
        }
        return md.toString().trim();
    }

    private static String firstParagraph(String text) {
        String t = text.replace("\r", "").trim();
        int idx = t.indexOf("\n\n");
        String chunk = idx > 0 ? t.substring(0, idx) : t;
        return truncate(chunk, 600);
    }

    private static String nullSafe(String s) {
        return s == null ? "" : s.trim();
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "\n\n[truncated]";
    }
}
