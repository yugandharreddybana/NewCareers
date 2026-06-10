package com.careerops.service;

import com.careerops.dto.AuthDtos.OnboardingCvParseEducationEntry;
import com.careerops.dto.AuthDtos.OnboardingCvParseProjectEntry;
import com.careerops.dto.AuthDtos.OnboardingCvParseResponse;
import com.careerops.dto.AuthDtos.OnboardingCvParseWorkEntry;
import com.careerops.exception.ApiException;
import com.careerops.model.UserProfile;
import com.careerops.model.UserProfile.EducationEntry;
import com.careerops.model.UserProfile.WorkExperienceEntry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Stateless CV parse for onboarding step 0 → prefill work, education, projects, tech stack, and markdown preview.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OnboardingCvParseService {

    private static final long MAX_BYTES = 5L * 1024 * 1024;
    private static final String PARSE_SOURCE_AI = "ai";
    private static final String PARSE_SOURCE_REGEX = "regex";
    private static final String AI_FALLBACK_WARNING = "AI parse unavailable; used standard parser";
    private static final String AI_TIMEOUT_WARNING = "AI parse timed out; used standard parser";

    public record ParseOptions(boolean aiAllowed) {
        public static ParseOptions regexOnly() {
            return new ParseOptions(false);
        }

        public static ParseOptions withAi() {
            return new ParseOptions(true);
        }
    }

    private record RegexParseResult(
        String cvMarkdown,
        String headline,
        List<OnboardingCvParseWorkEntry> workExperience,
        List<OnboardingCvParseEducationEntry> education,
        List<OnboardingCvParseProjectEntry> projects,
        String linkedInUrl,
        String githubUrl,
        String websiteUrl
    ) {}

    private final CvParserService parser;
    private final com.careerops.util.FileUtil fileUtil;
    private final OnboardingCvAiParseService aiParseService;
    private final OnboardingCvParseResultValidator parseValidator;
    private final CvSkillExtractionService skillExtraction;

    @Value("${onboarding.cv.ai-parse.enabled:true}")
    private boolean aiParseEnabled;

    /** When false, skip regex parsing and regex fallback — AI-only for local testing. */
    @Value("${onboarding.cv.regex.enabled:true}")
    private boolean regexEnabled;

    /** Max wait for NVIDIA AI enrich before returning regex prefill (avoids multi-minute onboarding stalls). */
    @Value("${onboarding.cv.ai-parse.timeout.ms:60000}")
    private long aiParseTimeoutMs;

    public OnboardingCvParseResponse parse(MultipartFile file) throws IOException {
        return parse(file, ParseOptions.regexOnly());
    }

    public OnboardingCvParseResponse parse(MultipartFile file, ParseOptions options) throws IOException {
        long parseStartNs = System.nanoTime();
        long extractMs = 0;
        long regexMs = 0;
        long aiMs = 0;
        boolean aiTimedOut = false;
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Upload your CV to continue");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "Max 5 MB");
        }

        String name = fileUtil.sanitizeFilename(file.getOriginalFilename());
        String lc = name.toLowerCase(Locale.ROOT);
        if (!(lc.endsWith(".pdf") || lc.endsWith(".docx"))) {
            throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Only PDF or DOCX");
        }
        byte[] bytes = file.getBytes();
        validateMagicBytes(bytes, name, file.getContentType());

        long extractStartNs = System.nanoTime();
        String parsedText = parser.extract(
            new java.io.ByteArrayInputStream(bytes),
            file.getContentType(),
            name
        ).trim();
        extractMs = (System.nanoTime() - extractStartNs) / 1_000_000;

        if (parsedText.isBlank()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "Could not read text from your CV file");
        }

        List<String> warnings = new ArrayList<>();
        String parseSource = regexEnabled ? PARSE_SOURCE_REGEX : PARSE_SOURCE_AI;
        RegexParseResult regex = null;

        List<OnboardingCvParseWorkEntry> work = List.of();
        List<OnboardingCvParseEducationEntry> education = List.of();
        List<OnboardingCvParseProjectEntry> projects = List.of();
        String headline = "";
        String markdown = "";
        String linkedIn = null;
        String github = null;
        String website = null;
        List<String> aiTech = List.of();
        List<String> extractedTargetRoles = List.of();

        if (regexEnabled) {
            long regexStartNs = System.nanoTime();
            regex = parseWithRegex(parsedText);
            regexMs = (System.nanoTime() - regexStartNs) / 1_000_000;
            work = regex.workExperience();
            education = regex.education();
            projects = regex.projects();
            headline = regex.headline();
            markdown = regex.cvMarkdown();
            linkedIn = regex.linkedInUrl();
            github = regex.githubUrl();
            website = regex.websiteUrl();
        }

        boolean tryAi = options != null && options.aiAllowed() && aiParseEnabled;
        if (!regexEnabled && !tryAi) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "CV parse is AI-only (regex disabled); sign-up session required for AI parse.");
        }
        if (tryAi) {
            long aiStartNs = System.nanoTime();
            AiParseAttempt aiAttempt = awaitAiParse(parsedText);
            aiMs = (System.nanoTime() - aiStartNs) / 1_000_000;
            aiTimedOut = aiAttempt.timedOut();
            Optional<OnboardingCvParseResultValidator.ValidatedAiParse> aiOpt = aiAttempt.result();
            if (aiOpt.isPresent()) {
                OnboardingCvParseResultValidator.ValidatedAiParse ai = aiOpt.get();
                parseSource = PARSE_SOURCE_AI;
                if (regexEnabled) {
                    work = pickList(ai.workExperience(), regex.workExperience());
                    education = pickList(ai.education(), regex.education());
                    projects = pickList(ai.projects(), regex.projects());
                    headline = coalesce(ai.headline(), regex.headline());
                    markdown = coalesce(ai.cvMarkdown(), regex.cvMarkdown());
                    linkedIn = coalesceUrl(ai.linkedInUrl(), regex.linkedInUrl());
                    github = coalesceUrl(ai.githubUrl(), regex.githubUrl());
                    website = coalesceUrl(ai.websiteUrl(), regex.websiteUrl());
                } else {
                    work = ai.workExperience();
                    education = ai.education();
                    projects = ai.projects();
                    headline = ai.headline();
                    markdown = ai.cvMarkdown();
                    linkedIn = ai.linkedInUrl();
                    github = ai.githubUrl();
                    website = ai.websiteUrl();
                }
                aiTech = ai.techStack();
                extractedTargetRoles = ai.targetRoles();
            } else if (!regexEnabled) {
                String detail = aiAttempt.timedOut()
                        ? "AI parse timed out after " + aiParseTimeoutMs + "ms"
                        : "AI parse failed";
                log.warn("Onboarding CV parse: {} (regex disabled, no fallback)", detail);
                throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, detail);
            } else {
                warnings.add(aiAttempt.timedOut() ? AI_TIMEOUT_WARNING : AI_FALLBACK_WARNING);
                log.warn("Onboarding CV parse: AI {}, using regex fallback",
                        aiAttempt.timedOut() ? "timed out after " + aiParseTimeoutMs + "ms" : "failed");
            }
        }

        List<String> dictionaryTech = skillExtraction.extractFromSkillsSection(parsedText);
        List<String> extractedTechStack = parseValidator.mergeTechStack(aiTech, dictionaryTech);

        long totalMs = (System.nanoTime() - parseStartNs) / 1_000_000;
        log.info("Onboarding CV parse: source={} roles={} education={} projects={} tech={} targetRoles={} "
                + "timingMs extract={} regex={} ai={} aiTimedOut={} total={}",
            parseSource, work.size(), education.size(), projects.size(),
            extractedTechStack.size(), extractedTargetRoles.size(),
            extractMs, regexMs, aiMs, aiTimedOut, totalMs);

        return new OnboardingCvParseResponse(
            markdown,
            headline,
            work,
            education,
            projects,
            work.size(),
            education.size(),
            projects.size(),
            blankToNull(linkedIn),
            blankToNull(github),
            blankToNull(website),
            extractedTechStack,
            extractedTargetRoles,
            parseSource,
            List.copyOf(warnings)
        );
    }

    private record AiParseAttempt(Optional<OnboardingCvParseResultValidator.ValidatedAiParse> result, boolean timedOut) {}

    private AiParseAttempt awaitAiParse(String parsedText) {
        CompletableFuture<Optional<OnboardingCvParseResultValidator.ValidatedAiParse>> future =
                CompletableFuture.supplyAsync(() -> aiParseService.parse(parsedText));
        try {
            return new AiParseAttempt(future.get(aiParseTimeoutMs, TimeUnit.MILLISECONDS), false);
        } catch (TimeoutException e) {
            future.cancel(true);
            return new AiParseAttempt(Optional.empty(), true);
        } catch (Exception e) {
            log.warn("Onboarding CV parse: AI error: {}", e.getMessage());
            return new AiParseAttempt(Optional.empty(), false);
        }
    }

    RegexParseResult parseWithRegex(String parsedText) {
        List<CvMarkdownSections.Section> sections = CvMarkdownSections.parse(parsedText);
        String experienceBody = sectionBody(sections, "Professional experience");
        String educationBody = sectionBody(sections, "Education");
        String projectsBody = sectionBody(sections, "Projects");
        String summaryBody = sectionBody(sections, "Professional summary");
        if (summaryBody.isBlank()) {
            summaryBody = sectionBody(sections, "Header");
        }

        List<OnboardingCvParseWorkEntry> work = parseWorkExperience(experienceBody);
        List<OnboardingCvParseEducationEntry> education = parseEducation(educationBody);
        List<OnboardingCvParseProjectEntry> projects = parseProjects(projectsBody);
        String headline = inferHeadline(summaryBody);
        String headerBody = sectionBody(sections, "Header");
        if (headerBody.isBlank()) {
            headerBody = summaryBody;
        }
        CvHeaderParser.HeaderData headerLinks = CvHeaderParser.parse(headerBody, null, null);

        UserProfile profile = buildTempProfile(work, education);
        String markdown = buildMarkdown(parsedText, profile, projects);

        return new RegexParseResult(
            markdown,
            headline,
            work,
            education,
            projects,
            blankToNull(headerLinks.linkedInUrl()),
            blankToNull(headerLinks.githubUrl()),
            blankToNull(headerLinks.portfolioUrl())
        );
    }

    private static <T> List<T> pickList(List<T> primary, List<T> fallback) {
        if (primary != null && !primary.isEmpty()) {
            return primary;
        }
        return fallback != null ? fallback : List.of();
    }

    private static String coalesce(String primary, String fallback) {
        if (primary != null && !primary.isBlank()) {
            return primary.trim();
        }
        return fallback != null ? fallback.trim() : "";
    }

    private static String coalesceUrl(String primary, String fallback) {
        String p = coalesce(primary, "");
        if (!p.isBlank()) return p;
        return fallback != null ? fallback : "";
    }

    private static String sectionBody(List<CvMarkdownSections.Section> sections, String name) {
        for (CvMarkdownSections.Section s : sections) {
            if (name.equalsIgnoreCase(s.name())) {
                return s.body() != null ? s.body().trim() : "";
            }
        }
        return "";
    }

    private static List<OnboardingCvParseWorkEntry> parseWorkExperience(String body) {
        if (body.isBlank()) {
            return List.of();
        }
        List<OnboardingCvParseWorkEntry> out = new ArrayList<>();
        for (String block : ExperienceSectionParser.splitIntoRoleBlocks(body)) {
            ExperienceSectionParser.ParsedRole role = ExperienceSectionParser.parseRoleBlock(block);
            CvDateRangeParser.ParsedDateRange dates = CvDateRangeParser.parse(role.dates());
            String description = String.join("\n", role.bullets()).trim();
            if (role.title().isBlank() && role.company().isBlank()) {
                continue;
            }
            out.add(new OnboardingCvParseWorkEntry(
                role.title(),
                role.company(),
                dates.startDate(),
                dates.current() ? "" : dates.endDate(),
                dates.current(),
                description,
                role.location()
            ));
        }
        return out;
    }

    private static List<OnboardingCvParseEducationEntry> parseEducation(String body) {
        List<OnboardingCvParseEducationEntry> out = new ArrayList<>();
        for (EducationSectionParser.ParsedEducation e : EducationSectionParser.parseEntries(body)) {
            out.add(new OnboardingCvParseEducationEntry(
                e.schoolName(),
                e.degree(),
                e.fieldOfStudy(),
                e.startYear(),
                e.endYear(),
                e.graduationYear(),
                e.location()
            ));
        }
        return out;
    }

    private static List<OnboardingCvParseProjectEntry> parseProjects(String body) {
        List<OnboardingCvParseProjectEntry> out = new ArrayList<>();
        for (ProjectsSectionParser.ParsedProject p : ProjectsSectionParser.parseEntries(body)) {
            out.add(new OnboardingCvParseProjectEntry(
                p.title(), p.description(), p.url(), p.location(), p.techTags()
            ));
        }
        return out;
    }

    private static String inferHeadline(String summaryBody) {
        if (summaryBody == null || summaryBody.isBlank()) {
            return "";
        }
        for (String raw : summaryBody.split("\\r?\\n")) {
            String line = raw.strip().replaceFirst("^#+\\s*", "");
            if (line.isBlank() || line.length() > 120) {
                continue;
            }
            if (line.matches("(?i).*(email|phone|linkedin|github|@).*")) {
                continue;
            }
            return line;
        }
        return "";
    }

    private static UserProfile buildTempProfile(
        List<OnboardingCvParseWorkEntry> work,
        List<OnboardingCvParseEducationEntry> education
    ) {
        List<WorkExperienceEntry> workEntries = work.stream()
            .map(w -> WorkExperienceEntry.builder()
                .jobTitle(w.jobTitle())
                .companyName(w.companyName())
                .startDate(w.startDate())
                .endDate(w.endDate())
                .current(w.current())
                .description(w.description())
                .location(w.location())
                .build())
            .toList();

        List<EducationEntry> eduEntries = education.stream()
            .map(e -> EducationEntry.builder()
                .schoolName(e.schoolName())
                .degree(e.degree())
                .fieldOfStudy(e.fieldOfStudy())
                .startYear(e.startYear())
                .endYear(e.endYear())
                .graduationYear(e.graduationYear())
                .location(e.location())
                .build())
            .toList();

        return UserProfile.builder()
            .workExperience(new ArrayList<>(workEntries))
            .education(new ArrayList<>(eduEntries))
            .build();
    }

    private static String buildMarkdown(
        String parsedText,
        UserProfile profile,
        List<OnboardingCvParseProjectEntry> projects
    ) {
        String base = CvNormalizationService.buildDeterministicMarkdown(parsedText, profile);
        if (projects.isEmpty()) {
            return base;
        }
        StringBuilder md = new StringBuilder(base);
        md.append("\n\n## Projects\n\n");
        for (OnboardingCvParseProjectEntry p : projects) {
            if (!p.title().isBlank()) {
                md.append("### ").append(p.title().trim()).append("\n");
            }
            if (p.url() != null && !p.url().isBlank()) {
                md.append(p.url().trim()).append("\n");
            }
            if (p.description() != null && !p.description().isBlank()) {
                md.append(p.description().trim()).append("\n\n");
            }
        }
        return md.toString().trim();
    }

    private static String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private void validateMagicBytes(byte[] bytes, String name, String contentType) {
        if (name == null || contentType == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid file metadata");
        }
        if (bytes == null || bytes.length < 4) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "File too small or invalid");
        }

        boolean magicPdf = (bytes[0] == 0x25 && bytes[1] == 0x50 && bytes[2] == 0x44 && bytes[3] == 0x46);
        boolean magicZip = (bytes[0] == 0x50 && bytes[1] == 0x4B && bytes[2] == 0x03 && bytes[3] == 0x04);

        String ext = name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        boolean extPdf = "pdf".equals(ext);
        boolean extDocx = "docx".equals(ext);
        boolean ctPdf = "application/pdf".equals(contentType);
        boolean ctDocx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document".equals(contentType);
        boolean loose = "application/octet-stream".equals(contentType);

        boolean validPdf = magicPdf && extPdf && (ctPdf || loose);
        boolean validDocx = magicZip && extDocx && (ctDocx || loose);

        if (!validPdf && !validDocx) {
            log.error("Onboarding CV validation failed: magicPdf={} extPdf={} ctPdf={} magicZip={} extDocx={} ctDocx={}",
                    magicPdf, extPdf, ctPdf, magicZip, extDocx, ctDocx);
            throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "Security violation: File content, extension, and type do not match (Expected PDF or DOCX).");
        }
    }
}
