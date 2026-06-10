package com.careerops.service;

import com.careerops.dto.AuthDtos.OnboardingCvParseEducationEntry;
import com.careerops.dto.AuthDtos.OnboardingCvParseProjectEntry;
import com.careerops.dto.AuthDtos.OnboardingCvParseWorkEntry;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Validates and normalizes AI JSON output for onboarding CV parse.
 */
@Component
public class OnboardingCvParseResultValidator {

    static final int MAX_WORK = 20;
    static final int MAX_EDUCATION = 10;
    static final int MAX_PROJECTS = 15;
    static final int MAX_TECH = 40;
    static final int MAX_TARGET_ROLES = 8;
    static final int MAX_MARKDOWN_CHARS = 32_768;
    static final int MAX_WARNINGS = 5;

    private static final Pattern DATE_PATTERN = Pattern.compile("^\\d{4}(-\\d{2})?$");
    private static final Pattern SKILL_ALLOWLIST = Pattern.compile("^[A-Za-z0-9+#.\\-/ ]{2,40}$");
    private static final Pattern ROLE_ALLOWLIST = Pattern.compile("^[A-Za-z0-9+#.,'()/&\\- ]{2,80}$");
    private static final Pattern BLOCKLIST = Pattern.compile("(?i).*(https?://|www\\.|@).*");

    public record ValidatedAiParse(
        String cvMarkdown,
        String headline,
        List<OnboardingCvParseWorkEntry> workExperience,
        List<OnboardingCvParseEducationEntry> education,
        List<OnboardingCvParseProjectEntry> projects,
        List<String> techStack,
        List<String> targetRoles,
        String linkedInUrl,
        String githubUrl,
        String websiteUrl
    ) {}

    public ValidatedAiParse validate(JsonNode root) {
        if (root == null || root.isMissingNode() || !root.isObject()) {
            throw new IllegalArgumentException("AI parse response is not a JSON object");
        }
        if (root.has("raw") && root.size() == 1) {
            throw new IllegalArgumentException("AI parse response was not valid JSON");
        }

        String markdown = sanitizeMarkdown(text(root, "cvMarkdown", 0, MAX_MARKDOWN_CHARS));
        if (markdown.contains("<script")) {
            throw new IllegalArgumentException("cvMarkdown contains disallowed content");
        }

        List<OnboardingCvParseWorkEntry> work = parseWork(root.path("workExperience"));
        List<OnboardingCvParseEducationEntry> education = parseEducation(root.path("education"));
        List<OnboardingCvParseProjectEntry> projects = parseProjects(root.path("projects"));
        List<String> tech = parseTechStack(root.path("techStack"));
        List<String> targetRoles = parseTargetRoles(root.path("targetRoles"));

        ValidatedAiParse parsed = new ValidatedAiParse(
            markdown,
            text(root, "headline", 0, 120),
            work,
            education,
            projects,
            tech,
            targetRoles,
            validUrl(text(root, "linkedInUrl", 0, 500)),
            validUrl(text(root, "githubUrl", 0, 500)),
            validUrl(text(root, "websiteUrl", 0, 500))
        );
        if (!hasExtractedContent(parsed)) {
            throw new IllegalArgumentException("AI parse response contained no usable CV fields");
        }
        return parsed;
    }

    /** True when the model returned at least one field we can prefill from. */
    public boolean hasExtractedContent(ValidatedAiParse parse) {
        if (parse == null) {
            return false;
        }
        if (!parse.workExperience().isEmpty()
            || !parse.education().isEmpty()
            || !parse.projects().isEmpty()
            || !parse.techStack().isEmpty()
            || !parse.targetRoles().isEmpty()) {
            return true;
        }
        if (parse.headline() != null && !parse.headline().isBlank()) {
            return true;
        }
        String linkedIn = parse.linkedInUrl();
        String github = parse.githubUrl();
        String website = parse.websiteUrl();
        if ((linkedIn != null && !linkedIn.isBlank())
            || (github != null && !github.isBlank())
            || (website != null && !website.isBlank())) {
            return true;
        }
        String markdown = parse.cvMarkdown();
        return markdown != null
            && markdown.length() >= 80
            && markdown.contains("##");
    }

    public List<String> mergeTechStack(List<String> aiTech, List<String> dictionaryTech) {
        LinkedHashSetOrdered out = new LinkedHashSetOrdered();
        if (aiTech != null) {
            for (String s : aiTech) {
                if (out.size() >= MAX_TECH) break;
                out.add(s);
            }
        }
        if (dictionaryTech != null) {
            for (String s : dictionaryTech) {
                if (out.size() >= MAX_TECH) break;
                String canon = CvSkillCanonical.canonicalize(s);
                if (canon != null && !canon.isBlank()) {
                    out.add(canon);
                }
            }
        }
        return out.toList();
    }

    private List<OnboardingCvParseWorkEntry> parseWork(JsonNode arr) {
        List<OnboardingCvParseWorkEntry> out = new ArrayList<>();
        if (!arr.isArray()) return out;
        for (JsonNode n : arr) {
            if (out.size() >= MAX_WORK) break;
            if (!n.isObject()) continue;
            String title = text(n, "jobTitle", 0, 200);
            String company = text(n, "companyName", 0, 200);
            if (title.isBlank() && company.isBlank()) continue;
            String start = normalizeDate(text(n, "startDate", 0, 7));
            String end = normalizeDate(text(n, "endDate", 0, 7));
            boolean current = n.path("current").asBoolean(false);
            out.add(new OnboardingCvParseWorkEntry(
                title,
                company,
                start,
                current ? "" : end,
                current,
                text(n, "description", 0, 4000),
                text(n, "location", 0, 120)
            ));
        }
        return List.copyOf(out);
    }

    private List<OnboardingCvParseEducationEntry> parseEducation(JsonNode arr) {
        List<OnboardingCvParseEducationEntry> out = new ArrayList<>();
        if (!arr.isArray()) return out;
        for (JsonNode n : arr) {
            if (out.size() >= MAX_EDUCATION) break;
            if (!n.isObject()) continue;
            String school = text(n, "schoolName", 0, 200);
            String degree = text(n, "degree", 0, 120);
            if (school.isBlank() && degree.isBlank()) continue;
            out.add(new OnboardingCvParseEducationEntry(
                school,
                degree,
                text(n, "fieldOfStudy", 0, 120),
                normalizeYear(text(n, "startYear", 0, 4)),
                normalizeYear(text(n, "endYear", 0, 4)),
                normalizeYear(text(n, "graduationYear", 0, 4)),
                text(n, "location", 0, 120)
            ));
        }
        return List.copyOf(out);
    }

    private List<OnboardingCvParseProjectEntry> parseProjects(JsonNode arr) {
        List<OnboardingCvParseProjectEntry> out = new ArrayList<>();
        if (!arr.isArray()) return out;
        for (JsonNode n : arr) {
            if (out.size() >= MAX_PROJECTS) break;
            if (!n.isObject()) continue;
            String title = text(n, "title", 0, 200);
            if (title.isBlank()) continue;
            List<String> tags = new ArrayList<>();
            JsonNode techTags = n.path("techTags");
            if (techTags.isArray()) {
                for (JsonNode t : techTags) {
                    if (tags.size() >= 20) break;
                    String tag = sanitizeSkillToken(t.asText(""));
                    if (!tag.isBlank()) tags.add(tag);
                }
            }
            String description = text(n, "description", 0, 4000);
            String url = resolveProjectUrl(text(n, "url", 0, 500), description);
            if (!url.isBlank()) {
                description = ProjectLinkExtractor.stripUrls(description);
            }
            out.add(new OnboardingCvParseProjectEntry(
                title,
                description,
                url.isBlank() ? null : url,
                text(n, "location", 0, 120),
                List.copyOf(tags)
            ));
        }
        return List.copyOf(out);
    }

    private List<String> parseTechStack(JsonNode arr) {
        List<String> out = new ArrayList<>();
        if (!arr.isArray()) return out;
        for (JsonNode n : arr) {
            if (out.size() >= MAX_TECH) break;
            String skill = sanitizeSkillToken(n.asText(""));
            if (!skill.isBlank()) {
                out.add(CvSkillCanonical.canonicalize(skill));
            }
        }
        return List.copyOf(out);
    }

    private List<String> parseTargetRoles(JsonNode arr) {
        LinkedHashSetOrdered out = new LinkedHashSetOrdered();
        if (!arr.isArray()) return out.toList();
        for (JsonNode n : arr) {
            if (out.size() >= MAX_TARGET_ROLES) break;
            String role = sanitizeRoleToken(n.asText(""));
            if (!role.isBlank()) {
                out.add(role);
            }
        }
        return out.toList();
    }

    static String sanitizeRoleToken(String raw) {
        if (raw == null || raw.isBlank()) return "";
        String trimmed = raw.trim();
        if (trimmed.length() < 2 || trimmed.length() > 80) return "";
        if (BLOCKLIST.matcher(trimmed).matches()) return "";
        if (!ROLE_ALLOWLIST.matcher(trimmed).matches()) return "";
        return OnboardingRoleCatalog.normalize(trimmed);
    }

    static String sanitizeSkillToken(String raw) {
        if (raw == null || raw.isBlank()) return "";
        String trimmed = raw.trim();
        if (trimmed.length() > 40 || BLOCKLIST.matcher(trimmed).matches()) return "";
        if (!SKILL_ALLOWLIST.matcher(trimmed).matches()) return "";
        return CvSkillCanonical.canonicalize(trimmed);
    }

    private static String text(JsonNode node, String field, int minLen, int maxLen) {
        String v = node.path(field).asText("").trim();
        if (v.length() < minLen) return "";
        if (v.length() > maxLen) return v.substring(0, maxLen);
        return v;
    }

    private static String normalizeDate(String value) {
        if (value == null || value.isBlank()) return "";
        String v = value.trim();
        if (DATE_PATTERN.matcher(v).matches()) return v;
        return "";
    }

    private static String normalizeYear(String value) {
        if (value == null || value.isBlank()) return "";
        String v = value.trim();
        if (v.matches("^\\d{4}$")) return v;
        return "";
    }

    private static String resolveProjectUrl(String rawUrl, String description) {
        String fromField = ProjectLinkExtractor.normalizeUrl(rawUrl);
        if (!fromField.isBlank()) {
            return fromField;
        }
        String validFromField = validUrl(rawUrl);
        if (validFromField != null && !validFromField.isBlank()) {
            return validFromField;
        }
        return ProjectLinkExtractor.extractPrimary(description);
    }

    private static String validUrl(String value) {
        if (value == null || value.isBlank()) return null;
        String v = value.trim();
        if (!v.toLowerCase(Locale.ROOT).startsWith("http://")
            && !v.toLowerCase(Locale.ROOT).startsWith("https://")) {
            return null;
        }
        if (v.length() > 500) return null;
        return v;
    }

    private static String sanitizeMarkdown(String md) {
        if (md == null) return "";
        return md
            .replaceAll("(?is)<script[^>]*>.*?</script>", "")
            .replaceAll("(?i)<iframe[^>]*>.*?</iframe>", "")
            .replaceAll("<[^>]+>", "")
            .trim();
    }

    /** Preserves insertion order with case-insensitive dedupe. */
    private static final class LinkedHashSetOrdered {
        private final List<String> items = new ArrayList<>();
        private final List<String> keys = new ArrayList<>();

        void add(String value) {
            if (value == null || value.isBlank()) return;
            String key = value.toLowerCase(Locale.ROOT);
            if (keys.contains(key)) return;
            keys.add(key);
            items.add(value);
        }

        int size() {
            return items.size();
        }

        List<String> toList() {
            return List.copyOf(items);
        }
    }
}
