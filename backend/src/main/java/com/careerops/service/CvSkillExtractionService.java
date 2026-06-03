package com.careerops.service;

import com.careerops.model.UserProfile;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Derives ATS-relevant skills from the user's CV text and profile tech stack.
 * Used for job-description highlighting and heuristic evaluations when AI is unavailable.
 */
@Service
public class CvSkillExtractionService {

    private static final List<String> KNOWN_SKILLS = List.of(
        "Java", "JavaScript", "TypeScript", "Python", "Go", "Golang", "Rust", "C#", "C++", "Kotlin", "Swift",
        "React", "React.js", "Next.js", "Nextjs", "Vue", "Vue.js", "Angular", "Svelte", "Node", "Node.js",
        "Express", "NestJS", "Spring", "Spring Boot", "Django", "Flask", "FastAPI", ".NET", "ASP.NET",
        "HTML", "HTML5", "CSS", "CSS3", "Tailwind", "Tailwind CSS", "SASS", "GraphQL", "REST", "REST API", "gRPC",
        "PostgreSQL", "Postgres", "MySQL", "SQL Server", "MongoDB", "Redis", "Elasticsearch", "DynamoDB", "SQL",
        "AWS", "Azure", "GCP", "Google Cloud", "Docker", "Kubernetes", "K8s", "Terraform", "CI/CD",
        "Git", "GitHub", "GitHub Actions", "GitLab", "Bitbucket", "Jenkins", "Agile", "Scrum", "Jira", "SDLC",
        "Kafka", "RabbitMQ", "Microservices", "API", "OAuth", "JWT", "Linux", "Unix",
        "Figma", "Jest", "Cypress", "Playwright", "JUnit", "Maven", "Gradle", "npm", "Webpack", "Vite",
        "Redux", "Zustand", "TanStack Query", "React Query", "Prisma", "Hibernate", "JPA",
        "Postman", "SonarQube", "TDD", "SOLID", "OOP", "Design Patterns",
        "Machine Learning", "ML", "AI", "LLM", "NLP", "Data Engineering", "ETL", "Spark", "Hadoop",
        "Tableau", "Power BI", "Snowflake", "dbt", "Airflow", "Pandas", "NumPy",
        "Leadership", "Mentoring", "Stakeholder management", "Communication"
    );

    private static final Set<String> SKILLS_SECTION_NAMES = Set.of(
        "skills", "technical skills", "core skills", "key skills", "technologies", "tech stack", "tools"
    );

    private static final Pattern CATEGORY_LINE = Pattern.compile(
        "^\\s*(?:[-*•]\\s*)?([A-Za-z][A-Za-z &/\\-]{0,32}):\\s*(.+)$");

    private static final Pattern BULLET_LINE = Pattern.compile("^\\s*[-*•]\\s+(.+)$");

    private static final Set<String> STOP_TOKENS = Set.of(
        "and", "or", "with", "including", "etc", "years", "year", "experience", "strong", "good",
        "proficient", "familiar", "knowledge", "skills", "skill", "tools", "tooling"
    );

    private static final Set<String> NON_SKILL_CATEGORY_LABELS = Set.of(
        "email", "e-mail", "phone", "mobile", "tel", "telephone", "linkedin", "github",
        "website", "portfolio", "address", "location", "contact", "name"
    );

    private static final Pattern EMAIL_LIKE = Pattern.compile(".+@.+\\..+");
    private static final Pattern PHONE_LIKE = Pattern.compile("^[+\\d()\\-.\\s]{7,}$");

    /**
     * Merged, de-duplicated skills: profile tech stack first, then Skills-section tokens from the CV only.
     */
    public List<String> extractForUser(UUID userId, UserProfile profile, String cvText) {
        LinkedHashSet<String> out = new LinkedHashSet<>();
        if (profile != null && profile.getTechStack() != null) {
            for (String s : profile.getTechStack()) {
                if (s != null && !s.isBlank()) out.add(CvSkillCanonical.canonicalize(s));
            }
        }
        if (cvText != null && !cvText.isBlank()) {
            for (String s : extractFromSkillsSection(cvText)) {
                out.add(CvSkillCanonical.canonicalize(s));
            }
        }
        return CvSkillCanonical.dedupeCanonical(List.copyOf(out));
    }

    /** Dictionary scan — for job descriptions and short snippets only, not full CV bodies. */
    public List<String> extractFromText(String text) {
        if (text == null || text.isBlank()) return List.of();
        String haystack = text.replace("\r\n", "\n").toLowerCase(Locale.ROOT);
        LinkedHashSet<String> found = new LinkedHashSet<>();
        for (String skill : KNOWN_SKILLS) {
            if (containsSkill(haystack, skill)) {
                found.add(CvSkillCanonical.canonicalize(skill));
            }
        }
        return List.copyOf(found);
    }

    /** Parses only the CV Skills section(s) — never scans experience, contact, or summary. */
    public List<String> extractFromSkillsSection(String cvText) {
        if (cvText == null || cvText.isBlank()) return List.of();
        LinkedHashSet<String> found = new LinkedHashSet<>();
        String skillsBlock = concatSkillsSectionBodies(cvText);
        if (skillsBlock.isBlank()) return List.of();
        for (String token : extractListTokensFromSkillsBlock(skillsBlock)) {
            found.add(CvSkillCanonical.canonicalize(token));
        }
        for (String skill : extractFromText(skillsBlock)) {
            found.add(CvSkillCanonical.canonicalize(skill));
        }
        return List.copyOf(found);
    }

    /** @deprecated use {@link #extractFromSkillsSection} */
    @Deprecated
    public List<String> extractFromCvText(String cvText) {
        return extractFromSkillsSection(cvText);
    }

    /** Result of scanning each JD skill against the full CV (any section). */
    public record JdCvSkillMatch(List<String> requiredFromJob, List<String> matchedInCv, List<String> missingFromCv) {}

    /**
     * JD-first: list every dictionary skill in the job text, then for each one check whether
     * that skill appears anywhere in the CV (experience, projects, skills — not Skills section only).
     */
    public JdCvSkillMatch matchJobDescriptionToCv(String jobText, String cvText) {
        List<String> required = extractFromText(jobText);
        if (required.isEmpty()) {
            return new JdCvSkillMatch(List.of(), List.of(), List.of());
        }
        String cvHay = cvText == null || cvText.isBlank()
            ? ""
            : cvText.replace("\r\n", "\n").toLowerCase(Locale.ROOT);
        List<String> matched = new ArrayList<>();
        List<String> gaps = new ArrayList<>();
        for (String skill : required) {
            String canon = CvSkillCanonical.canonicalize(skill);
            if (isSkillMentionedInFullCv(cvHay, skill)) {
                matched.add(canon);
            } else {
                gaps.add(canon);
            }
        }
        return new JdCvSkillMatch(
            required,
            CvSkillCanonical.dedupeCanonical(matched),
            CvSkillCanonical.dedupeCanonical(gaps));
    }

    /** Whether the skill word appears anywhere in the CV body (alias-aware, word-boundary safe for Java). */
    public boolean isSkillMentionedInFullCv(String cvHaystackLower, String skill) {
        if (skill == null || skill.isBlank()) return false;
        if (cvHaystackLower == null || cvHaystackLower.isBlank()) return false;
        return CvSkillCanonical.jobHaystackContains(cvHaystackLower, skill);
    }

    public List<String> matchedInJob(List<String> skills, String jobHaystack) {
        if (skills == null || jobHaystack == null) return List.of();
        String hay = jobHaystack.toLowerCase(Locale.ROOT);
        LinkedHashSet<String> matched = new LinkedHashSet<>();
        for (String s : skills) {
            if (s == null || s.isBlank()) continue;
            if (CvSkillCanonical.jobHaystackContains(hay, s)) {
                matched.add(CvSkillCanonical.canonicalize(s));
            }
        }
        return List.copyOf(matched);
    }

    /**
     * Skills mentioned in the job text (from our dictionary) that are not evidenced in the user's CV/profile list.
     */
    public List<String> gapsInJob(List<String> userSkills, String jobText) {
        if (jobText == null || jobText.isBlank()) return List.of();
        List<String> inPosting = extractFromText(jobText);
        if (inPosting.isEmpty()) return List.of();
        LinkedHashSet<String> gaps = new LinkedHashSet<>();
        for (String skill : inPosting) {
            String canon = CvSkillCanonical.canonicalize(skill);
            if (!CvSkillCanonical.userHasSkill(userSkills, canon)) {
                gaps.add(canon);
            }
        }
        return List.copyOf(gaps);
    }

    public List<String> unmatchedInJob(List<String> skills, String jobHaystack) {
        if (skills == null) return List.of();
        Set<String> matchedCanon = new HashSet<>(matchedInJob(skills, jobHaystack));
        LinkedHashSet<String> unmatched = new LinkedHashSet<>();
        for (String s : skills) {
            if (s == null || s.isBlank()) continue;
            String canon = CvSkillCanonical.canonicalize(s);
            if (!matchedCanon.contains(canon)) {
                unmatched.add(canon);
            }
        }
        return List.copyOf(unmatched);
    }

    private static String concatSkillsSectionBodies(String cvText) {
        StringBuilder sb = new StringBuilder();
        for (CvMarkdownSections.Section section : CvMarkdownSections.parse(cvText)) {
            if (!isSkillsSection(section.name())) continue;
            if (sb.length() > 0) sb.append('\n');
            sb.append(section.body());
        }
        if (sb.length() > 0) return sb.toString();
        return fallbackSkillsBlock(cvText);
    }

    /** Plain "Skills" / "## Skills" headings not caught by {@link CvMarkdownSections}. */
    private static String fallbackSkillsBlock(String cvText) {
        Pattern block = Pattern.compile(
            "(?im)^(?:#{1,3}\\s+)?skills\\s*:?\\s*$\\n([\\s\\S]*?)(?=\\n(?:#{1,3}\\s+|(?=[A-Z][A-Za-z &/\\-]{2,40}:)\\s*$)|\\z)");
        Matcher m = block.matcher(cvText.replace("\r\n", "\n"));
        if (m.find()) {
            return m.group(1).trim();
        }
        return "";
    }

    private List<String> extractListTokensFromSkillsBlock(String skillsBlock) {
        LinkedHashSet<String> tokens = new LinkedHashSet<>();
        collectTokensFromBlock(skillsBlock, tokens);
        return List.copyOf(tokens);
    }

    private static boolean isSkillsSection(String name) {
        if (name == null) return false;
        return SKILLS_SECTION_NAMES.contains(name.toLowerCase(Locale.ROOT).trim());
    }

    private void collectTokensFromBlock(String block, LinkedHashSet<String> tokens) {
        if (block == null || block.isBlank()) return;
        for (String line : block.split("\n")) {
            String trimmed = line.trim();
            if (trimmed.isBlank()) continue;
            Matcher category = CATEGORY_LINE.matcher(trimmed);
            if (category.matches()) {
                String label = category.group(1).trim().toLowerCase(Locale.ROOT);
                if (NON_SKILL_CATEGORY_LABELS.contains(label)) continue;
                collectDelimitedTokens(category.group(2), tokens);
                continue;
            }
            Matcher bullet = BULLET_LINE.matcher(trimmed);
            if (bullet.matches()) {
                collectDelimitedTokens(bullet.group(1), tokens);
                continue;
            }
            if (trimmed.contains(",") || trimmed.contains(";") || trimmed.contains("|")) {
                collectDelimitedTokens(trimmed, tokens);
            } else {
                addToken(trimmed, tokens);
            }
        }
    }

    private void collectDelimitedTokens(String chunk, LinkedHashSet<String> tokens) {
        if (chunk == null || chunk.isBlank()) return;
        for (String part : chunk.split("[,;|/•]")) {
            addToken(part, tokens);
        }
    }

    private void addToken(String raw, LinkedHashSet<String> tokens) {
        String cleaned = cleanToken(raw);
        if (!isPlausibleSkill(cleaned)) return;
        String resolved = resolveSkillToken(cleaned);
        if (resolved != null) {
            tokens.add(resolved);
        }
    }

    private static String cleanToken(String raw) {
        if (raw == null) return "";
        String t = raw.trim()
            .replaceAll("^[\"']|[\"']$", "")
            .replaceAll("^(?i)(and|or)\\s+", "")
            .replaceAll("\\([^)]*\\)", "")
            .replaceAll("\\[[^]]*]", "")
            .replaceAll("\\s{2,}", " ")
            .trim();
        int dot = t.indexOf('.');
        if (dot > 0) {
            t = t.substring(0, dot).trim();
        }
        return t;
    }

    private static boolean isPlausibleSkill(String token) {
        if (token == null || token.isBlank()) return false;
        if (token.length() < 2 || token.length() > 40) return false;
        String lower = token.toLowerCase(Locale.ROOT);
        if (STOP_TOKENS.contains(lower)) return false;
        if (lower.matches("^\\d+$")) return false;
        if (lower.contains(" is a ") || lower.contains(" experience")) return false;
        if (token.split("\\s+").length > 5) return false;
        if (token.contains("@") || EMAIL_LIKE.matcher(token).matches()) return false;
        if (PHONE_LIKE.matcher(token.replaceAll("\\s", "")).matches()) return false;
        return token.matches(".*[A-Za-z0-9].*");
    }

    private static String resolveSkillToken(String token) {
        String canon = CvSkillCanonical.canonicalize(token);
        if (!canon.equals(token.trim()) || KNOWN_SKILLS.stream().anyMatch(k -> k.equalsIgnoreCase(canon))) {
            return canon;
        }
        String lower = token.toLowerCase(Locale.ROOT);
        for (String known : KNOWN_SKILLS) {
            if (known.equalsIgnoreCase(token) || known.toLowerCase(Locale.ROOT).equals(lower)) {
                return CvSkillCanonical.canonicalize(known);
            }
        }
        return null;
    }

    private static boolean containsSkill(String haystackLower, String skill) {
        return CvSkillCanonical.jobHaystackContains(haystackLower, skill);
    }
}
