package com.careerops.service;

import java.util.*;
import java.util.regex.Pattern;

/**
 * Canonical skill names so React / React.js / ReactJS match consistently in evaluations and ATS.
 */
public final class CvSkillCanonical {

    private static final Map<String, String> ALIASES = buildAliases();

    private CvSkillCanonical() {}

    private static Map<String, String> buildAliases() {
        Map<String, String> m = new HashMap<>();
        alias(m, "React", "react", "react.js", "reactjs", "react js");
        alias(m, "JavaScript", "javascript", "js", "ecmascript", "es6", "es2015");
        alias(m, "TypeScript", "typescript", "ts");
        alias(m, "Node.js", "node", "nodejs", "node js");
        alias(m, "Next.js", "next", "nextjs", "next js");
        alias(m, "Vue.js", "vue", "vuejs", "vue js");
        alias(m, "Angular", "angular", "angularjs");
        alias(m, "Java", "java", "java 8", "java 11", "java 17", "java 21");
        alias(m, "Spring Boot", "spring", "spring boot", "springboot");
        alias(m, "PostgreSQL", "postgres", "postgresql", "psql");
        alias(m, "SQL Server", "sql server", "mssql", "microsoft sql server");
        alias(m, "AWS", "amazon web services", "amazon aws");
        alias(m, "Kubernetes", "k8s", "kube");
        alias(m, "Docker", "docker", "containerization", "containers");
        alias(m, "CI/CD", "cicd", "ci/cd", "continuous integration", "continuous delivery");
        alias(m, "Git", "git");
        alias(m, "GitHub", "github");
        alias(m, "GitHub Actions", "github actions");
        alias(m, "GitLab", "gitlab");
        alias(m, "Bitbucket", "bitbucket");
        alias(m, "REST API", "rest", "restful", "rest apis");
        alias(m, "GraphQL", "graphql");
        alias(m, "Python", "python", "python3");
        alias(m, "Go", "golang", "go lang");
        alias(m, "C#", "csharp", "c sharp", ".net", "dotnet", "asp.net", "aspnet");
        alias(m, "SQL", "mysql", "t-sql");
        alias(m, "MongoDB", "mongo");
        alias(m, "Redis", "redis cache");
        alias(m, "Tailwind CSS", "tailwind", "tailwindcss");
        alias(m, "HTML", "html5");
        alias(m, "CSS", "css3");
        alias(m, "Figma", "figma");
        alias(m, "Jira", "jira");
        alias(m, "Microservices", "microservices architecture", "microservice");
        return Map.copyOf(m);
    }

    private static void alias(Map<String, String> m, String canonical, String... variants) {
        for (String v : variants) {
            m.put(normalizeKey(v), canonical);
        }
        m.put(normalizeKey(canonical), canonical);
    }

    public static String canonicalize(String skill) {
        if (skill == null || skill.isBlank()) return skill;
        String key = normalizeKey(skill);
        return ALIASES.getOrDefault(key, skill.trim());
    }

    public static List<String> dedupeCanonical(List<String> skills) {
        if (skills == null) return List.of();
        LinkedHashSet<String> out = new LinkedHashSet<>();
        for (String s : skills) {
            if (s == null || s.isBlank()) continue;
            out.add(canonicalize(s));
        }
        return List.copyOf(out);
    }

    public static boolean sameSkill(String a, String b) {
        if (a == null || b == null) return false;
        return canonicalize(a).equalsIgnoreCase(canonicalize(b));
    }

    /** Whether the user's skill list already covers a posting requirement (alias-aware). */
    public static boolean userHasSkill(Collection<String> userSkills, String postingSkill) {
        if (userSkills == null || userSkills.isEmpty() || postingSkill == null || postingSkill.isBlank()) {
            return false;
        }
        String need = canonicalize(postingSkill);
        for (String u : userSkills) {
            if (u != null && sameSkill(u, need)) return true;
        }
        return false;
    }

    public static boolean jobHaystackContains(String haystackLower, String skill) {
        if (haystackLower == null || skill == null) return false;
        String canonical = canonicalize(skill);
        if (containsToken(haystackLower, canonical)) return true;
        String key = normalizeKey(skill);
        if (ALIASES.containsKey(key)) {
            if (containsToken(haystackLower, key)) return true;
            return containsToken(haystackLower, ALIASES.get(key));
        }
        for (Map.Entry<String, String> e : ALIASES.entrySet()) {
            if (e.getValue().equalsIgnoreCase(canonical) && containsToken(haystackLower, e.getKey())) {
                return true;
            }
        }
        return containsToken(haystackLower, skill);
    }

    private static boolean containsToken(String haystackLower, String skill) {
        String needle = skill.toLowerCase(Locale.ROOT).trim();
        if (needle.isEmpty()) return false;
        if ("java".equals(needle)) {
            return Pattern.compile("(?<![a-z])java(?![a-z])")
                .matcher(haystackLower)
                .find();
        }
        if (haystackLower.contains(needle)) return true;
        if (needle.endsWith(".js")) {
            String base = needle.substring(0, needle.length() - 3).trim();
            if (base.length() >= 2
                && Pattern.compile("\\b" + Pattern.quote(base) + "\\b")
                    .matcher(haystackLower)
                    .find()) {
                return true;
            }
        }
        if (needle.length() <= 3) {
            return Pattern.compile("\\b" + Pattern.quote(needle) + "\\b")
                .matcher(haystackLower)
                .find();
        }
        return false;
    }

    private static String normalizeKey(String skill) {
        return skill.toLowerCase(Locale.ROOT)
            .replace(".js", "js")
            .replaceAll("[^a-z0-9+#]+", " ")
            .trim();
    }
}
