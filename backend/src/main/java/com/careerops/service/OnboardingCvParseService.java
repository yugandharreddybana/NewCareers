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
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Stateless CV parse for onboarding step 0 → prefill work, education, and markdown preview.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OnboardingCvParseService {

    private static final long MAX_BYTES = 5L * 1024 * 1024;

    private final CvParserService parser;
    private final com.careerops.util.FileUtil fileUtil;

    public OnboardingCvParseResponse parse(MultipartFile file) throws IOException {
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
        String parsedText = parser.extract(
            new java.io.ByteArrayInputStream(bytes),
            file.getContentType(),
            name
        ).trim();

        if (parsedText.isBlank()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "Could not read text from your CV file");
        }

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

        log.info("Onboarding CV parse: roles={} education={} projects={}", work.size(), education.size(), projects.size());

        return new OnboardingCvParseResponse(
            markdown,
            headline,
            work,
            education,
            projects,
            work.size(),
            education.size(),
            projects.size(),
            blankToNull(headerLinks.linkedInUrl()),
            blankToNull(headerLinks.githubUrl()),
            blankToNull(headerLinks.portfolioUrl())
        );
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
}
