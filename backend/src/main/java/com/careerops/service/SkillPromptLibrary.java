package com.careerops.service;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Loads and caches skill prompts (SKILL.md) and reference documents.
 *
 * 4-Layer fallback chain:
 *   Layer 1: Upstream plugin repo (andrew-shwetzer/career-ops-plugin)
 *   Layer 2: Your fork (configurable via skill.prompt.fork.owner)
 *   Layer 3: Classpath bundled copies (src/main/resources/career-ops-skills/)
 *   Layer 4: Hardcoded minimal inline prompt (absolute last resort)
 *
 * Refreshes from GitHub at 3am daily. Falls back gracefully at each layer.
 * Logs which layer was used so operators know if prompts are stale.
 */
@Service
public class SkillPromptLibrary {

    private static final Logger log = LoggerFactory.getLogger(SkillPromptLibrary.class);

    // All 9 skill names
    static final List<String> ALL_SKILLS = List.of(
        "evaluate", "tailor-resume", "apply", "outreach",
        "research", "prep-interview", "compare", "triage", "scan"
    );

    // Reference docs to load alongside SKILL.md files
    static final List<String> REFERENCE_DOCS = List.of(
        "scoring-rubric.md",
        "archetypes.md",
        "ats-rules.md",
        "ats-endpoints.md",
        "resume-template.html",
        "profile-schema.md",
        "states.md"
    );

    // Reference docs each skill needs (to avoid bloating prompts with irrelevant docs)
    private static final Map<String, List<String>> SKILL_REFS = Map.of(
        "evaluate",       List.of("scoring-rubric.md", "archetypes.md", "profile-schema.md", "states.md"),
        "tailor-resume",  List.of("ats-rules.md", "ats-endpoints.md", "resume-template.html", "profile-schema.md"),
        "apply",          List.of("profile-schema.md", "states.md"),
        "outreach",       List.of("profile-schema.md"),
        "research",       List.of("profile-schema.md"),
        "prep-interview", List.of("scoring-rubric.md", "profile-schema.md"),
        "compare",        List.of("scoring-rubric.md", "states.md"),
        "triage",         List.of("scoring-rubric.md", "states.md"),
        "scan",           List.of("profile-schema.md")
    );

    @Value("${skill.prompt.upstream.owner:andrew-shwetzer}")
    private String upstreamOwner;

    @Value("${skill.prompt.upstream.repo:career-ops-plugin}")
    private String upstreamRepo;

    @Value("${skill.prompt.fork.owner:}")  // Set to your GitHub username
    private String forkOwner;

    @Value("${skill.prompt.fork.repo:career-ops-plugin}")
    private String forkRepo;

    @Value("${skill.prompt.github.branch:main}")
    private String branch;

    // Cache: key = "skills/{name}/SKILL.md" or "references/{name}"
    private final ConcurrentHashMap<String, String> cache = new ConcurrentHashMap<>();

    private final WebClient webClient = WebClient.builder()
            .codecs(cfg -> cfg.defaultCodecs().maxInMemorySize(2 * 1024 * 1024))
            .build();

    @PostConstruct
    public void init() {
        log.info("SkillPromptLibrary: loading prompts from GitHub (4-layer fallback)...");
        loadAll();
        log.info("SkillPromptLibrary: loaded {} entries into cache", cache.size());
    }

    @Scheduled(cron = "0 0 3 * * *") // 3am daily refresh
    public void refresh() {
        log.info("SkillPromptLibrary: scheduled daily refresh started");
        loadAll();
        log.info("SkillPromptLibrary: refresh complete, cache now has {} entries", cache.size());
    }

    // ================================================================
    // PUBLIC API
    // ================================================================

    /**
     * Build the full system prompt for a skill run.
     * = SKILL.md content + relevant reference docs appended as sections.
     */
    public String buildFullSystemPrompt(String skillName) {
        String skillMd = getSkillMd(skillName);
        List<String> refs = SKILL_REFS.getOrDefault(skillName, List.of());

        StringBuilder sb = new StringBuilder(skillMd);

        for (String ref : refs) {
            String refContent = cache.get("references/" + ref);
            if (refContent != null && !refContent.isBlank()) {
                sb.append("\n\n---\n## REFERENCE: ").append(ref).append("\n\n");
                sb.append(refContent);
            }
        }

        // Extra enhanced instructions for prep-interview
        if ("prep-interview".equals(skillName)) {
            sb.append("""
\n\n---\n## INTERVIEW PREP ENHANCED INSTRUCTIONS\n
Generate a comprehensive interview preparation pack with ALL of the following sections:
1. **Personal Questions** - Background, motivation, career goals (min 5)
2. **Easy Technical Questions** - Fundamentals, definitions (min 5)
3. **Medium Technical Questions** - Applied knowledge, patterns (min 5)
4. **Hard Technical Questions** - System design, architecture, edge cases (min 5)
5. **Coding Questions** - Algorithm/data structure problems with hints (min 3)
6. **Questions to Expect** - Company/role-specific likely questions (min 5)
7. **Topics to Study** - Prioritised reading list based on job requirements
For each question, provide the question, ideal answer structure, and what the interviewer is assessing.
""");
        }

        return sb.toString();
    }

    public String getSkillMd(String skillName) {
        return cache.getOrDefault("skills/" + skillName + "/SKILL.md",
                getFallbackPrompt(skillName));
    }

    // ================================================================
    // LOADING LOGIC
    // ================================================================

    private void loadAll() {
        // Skills
        for (String skill : ALL_SKILLS) {
            String path = "skills/" + skill + "/SKILL.md";
            String content = fetchWithFallback(path);
            if (content != null) cache.put(path, content);
        }
        // Reference docs
        for (String ref : REFERENCE_DOCS) {
            String path = "references/" + ref;
            String content = fetchWithFallback(path);
            if (content != null) cache.put(path, content);
        }
    }

    /**
     * Try fetching a file through the 4-layer fallback chain.
     * Returns content string or null if all layers failed.
     */
    private String fetchWithFallback(String filePath) {
        // Layer 1: Upstream repo
        String content = fetchFromGitHub(upstreamOwner, upstreamRepo, filePath);
        if (content != null) {
            log.debug("[Layer 1-upstream] loaded: {}", filePath);
            return content;
        }

        // Layer 2: Fork repo
        if (forkOwner != null && !forkOwner.isBlank()) {
            content = fetchFromGitHub(forkOwner, forkRepo, filePath);
            if (content != null) {
                log.warn("[Layer 2-fork] upstream unavailable, using fork for: {}", filePath);
                return content;
            }
        }

        // Layer 3: Classpath bundled copy
        content = loadFromClasspath(filePath);
        if (content != null) {
            log.warn("[Layer 3-classpath] GitHub unavailable, using bundled copy for: {}", filePath);
            return content;
        }

        // Layer 4: Hardcoded minimal fallback
        String skill = extractSkillName(filePath);
        if (skill != null) {
            log.error("[Layer 4-hardcoded] ALL layers failed for: {} — using minimal fallback", filePath);
            return getFallbackPrompt(skill);
        }

        log.error("All 4 layers failed for reference doc: {}", filePath);
        return null;
    }

    private String fetchFromGitHub(String owner, String repo, String filePath) {
        try {
            String url = "https://raw.githubusercontent.com/" +
                    owner + "/" + repo + "/" + branch + "/" + filePath;
            return webClient.get()
                    .uri(url)
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(10))
                    .block();
        } catch (Exception e) {
            log.debug("GitHub fetch failed ({}/{}): {} — {}", owner, repo, filePath, e.getMessage());
            return null;
        }
    }

    private String loadFromClasspath(String filePath) {
        try {
            String resource = "/career-ops-skills/" + filePath;
            InputStream is = getClass().getResourceAsStream(resource);
            if (is == null) return null;
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.debug("Classpath load failed for: {} — {}", filePath, e.getMessage());
            return null;
        }
    }

    private String extractSkillName(String filePath) {
        // filePath = "skills/{name}/SKILL.md"
        String[] parts = filePath.split("/");
        if (parts.length >= 2 && "skills".equals(parts[0])) return parts[1];
        return null;
    }

    /**
     * Absolute last-resort minimal prompt.
     * Ensures the app still functions even if all GitHub sources are down
     * and classpath copies are missing.
     */
    private String getFallbackPrompt(String skill) {
        return """
                You are CareerOps AI, a specialist career assistant.
                Skill: %s

                Use the tools available to read the user's profile, resume, and job details.
                Provide the most helpful, specific, and actionable output you can for this skill.
                Always call read_profile, read_resume, and read_job before generating output.
                Output valid JSON.
                """.formatted(skill);
    }
}
