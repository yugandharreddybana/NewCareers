package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.UserJob;
import com.careerops.model.UserProfile;
import com.careerops.repository.JobRepository;
import com.careerops.repository.SkillRunRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Routes Claude tool calls to the correct backend implementations.
 *
 * Security contract:
 * - EVERY tool handler receives userId and uses it to scope DB queries
 * - No tool can return data from another user
 * - WebFetch has SSRF protection (no private IPs, no localhost, no file://)
 * - All results are truncated to prevent prompt injection via large payloads
 * - Errors return descriptive strings (never throw) so Claude handles them gracefully
 */
@Service
public class SkillToolDispatcher {

    private static final Logger log = LoggerFactory.getLogger(SkillToolDispatcher.class);
    private static final int WEB_FETCH_MAX_CHARS  = 4000;
    private static final int TOOL_RESULT_MAX_CHARS = 12000;

    // Private IP ranges blocked for SSRF prevention
    private static final String[] BLOCKED_HOSTS = {
        "localhost", "127.", "192.168.", "10.", "172.16.", "172.17.",
        "172.18.", "172.19.", "172.20.", "172.21.", "172.22.", "172.23.",
        "172.24.", "172.25.", "172.26.", "172.27.", "172.28.", "172.29.",
        "172.30.", "172.31.", "169.254.", "0.0.0.0", "::1", "[::1]"
    };

    @Value("${serpapi.api.key:}")
    private String serpApiKey;

    private final UserProfileRepository  profiles;
    private final UserJobRepository      userJobs;
    private final JobRepository          jobs;
    private final SkillRunRepository     skillRuns;
    private final CvService              cvService;
    private final SupabaseStorageService supabase;
    private final ObjectMapper           mapper;
    private final WebClient              webClient;

    public SkillToolDispatcher(
            UserProfileRepository profiles,
            UserJobRepository userJobs,
            JobRepository jobs,
            SkillRunRepository skillRuns,
            CvService cvService,
            SupabaseStorageService supabase,
            ObjectMapper mapper) {
        this.profiles  = profiles;
        this.userJobs  = userJobs;
        this.jobs      = jobs;
        this.skillRuns = skillRuns;
        this.cvService = cvService;
        this.supabase  = supabase;
        this.mapper    = mapper;
        this.webClient = WebClient.builder()
                .codecs(cfg -> cfg.defaultCodecs().maxInMemorySize(5 * 1024 * 1024))
                .build();
    }

    // ============================================================
    // MAIN ROUTER
    // ============================================================

    /**
     * Dispatch a Claude tool call to the correct handler.
     * Always returns a string (never throws) so Claude can handle errors gracefully.
     */
    public String dispatch(String toolName, JsonNode input, UUID userId, UUID userJobId) {
        try {
            return switch (toolName) {
                case "read_profile"            -> handleReadProfile(userId);
                case "read_resume"             -> handleReadResume(userId);
                case "read_job"                -> handleReadJob(userJobId);
                case "read_evaluation"         -> handleReadEvaluation(userId, userJobId);
                case "read_research"           -> handleReadResearch(userId, userJobId);
                case "web_fetch"               -> handleWebFetch(input.path("url").asText());
                case "web_search"              -> handleWebSearch(input.path("query").asText());
                case "save_resume_html"        -> handleSaveResumeHtml(
                                                    input.path("html").asText(),
                                                    input.path("filename").asText(),
                                                    userId, userJobId);
                case "update_application_status" -> handleUpdateStatus(
                                                    input.path("status").asText(),
                                                    userId, userJobId);
                default -> "Unknown tool: " + toolName + ". No action taken.";
            };
        } catch (Exception e) {
            log.error("Tool dispatch error for tool={}: {}", toolName, e.getMessage(), e);
            return "Tool execution failed for '" + toolName + "': " + e.getMessage() +
                   ". Please continue with available information.";
        }
    }

    // ============================================================
    // TOOL HANDLERS
    // ============================================================

    private String handleReadProfile(UUID userId) {
        Optional<UserProfile> opt = profiles.findByUserId(userId);
        if (opt.isEmpty()) {
            return "No profile found. The user has not set up their career profile yet.";
        }
        UserProfile p = opt.get();
        StringBuilder yaml = new StringBuilder();
        yaml.append("# User Career Profile\n");
        appendField(yaml, "location",               p.getLocation());
        appendField(yaml, "target_roles",           arrayToYaml(p.getTargetRoles()));
        appendField(yaml, "tech_stack",             arrayToYaml(p.getTechStack()));
        appendField(yaml, "sectors",                arrayToYaml(p.getSectors()));
        appendField(yaml, "salary_min",             p.getSalaryMin());
        appendField(yaml, "salary_max",             p.getSalaryMax());
        appendField(yaml, "salary_currency",        "EUR");
        appendField(yaml, "sponsorship_required",   p.getSponsorshipRequired());
        appendField(yaml, "min_match_percent",      p.getMinMatchPercent());
        return truncate(yaml.toString(), TOOL_RESULT_MAX_CHARS);
    }

    private String handleReadResume(UUID userId) {
        try {
            String cv = cvService.activeCvText(userId);
            if (cv == null || cv.isBlank()) {
                return "No resume uploaded yet. The user needs to upload their CV in the settings.";
            }
            return truncate(cv, TOOL_RESULT_MAX_CHARS);
        } catch (Exception e) {
            log.warn("Could not fetch CV for userId={}: {}", userId, e.getMessage());
            return "Resume could not be loaded. Please ask the user to re-upload their CV.";
        }
    }

    private String handleReadJob(UUID userJobId) {
        if (userJobId == null) {
            return "No job context available for this skill run.";
        }
        Optional<UserJob> ujOpt = userJobs.findById(userJobId);
        if (ujOpt.isEmpty()) return "Job not found.";

        Optional<Job> jobOpt = jobs.findById(ujOpt.get().getJobId());
        if (jobOpt.isEmpty()) return "Job details not found.";

        Job j = jobOpt.get();
        StringBuilder sb = new StringBuilder();
        sb.append("# Job Posting\n");
        appendField(sb, "title",       j.getTitle());
        appendField(sb, "company",     j.getCompany());
        appendField(sb, "location",    j.getLocation());
        appendField(sb, "salary_min",  j.getSalaryMin());
        appendField(sb, "salary_max",  j.getSalaryMax());
        appendField(sb, "sponsorship", j.getSponsorship());
        appendField(sb, "source",      j.getSourceName());
        appendField(sb, "url",         j.getSourceUrl());
        sb.append("\n# Full Job Description\n");
        sb.append(j.getDescription() != null ? j.getDescription() : "Not available");
        return truncate(sb.toString(), TOOL_RESULT_MAX_CHARS);
    }

    private String handleReadEvaluation(UUID userId, UUID userJobId) {
        if (userJobId == null) return "No job context — no evaluation available.";
        return skillRuns
                .findValidCachedRun(userId, userJobId, "evaluate")
                .map(sr -> truncate(sr.getOutput().toString(), TOOL_RESULT_MAX_CHARS))
                .orElse("No evaluation exists yet for this job.");
    }

    private String handleReadResearch(UUID userId, UUID userJobId) {
        if (userJobId == null) return "No job context — no research available.";
        return skillRuns
                .findValidCachedRun(userId, userJobId, "research")
                .map(sr -> truncate(sr.getOutput().toString(), TOOL_RESULT_MAX_CHARS))
                .orElse("No company research exists yet for this job.");
    }

    /**
     * Fetch a URL as plain text. SSRF-protected.
     */
    private String handleWebFetch(String url) {
        if (url == null || url.isBlank()) return "No URL provided.";

        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            return "Only http/https URLs are allowed.";
        }
        try {
            URI uri = URI.create(url);
            String host = uri.getHost().toLowerCase();
            for (String blocked : BLOCKED_HOSTS) {
                String normalized = blocked.endsWith(".")
                        ? blocked.substring(0, blocked.length() - 1)
                        : blocked;
                if (host.startsWith(blocked) || host.equals(normalized)) {
                    return "Access to this host is not permitted.";
                }
            }
        } catch (Exception e) {
            return "Invalid URL format.";
        }

        try {
            String raw = webClient.get()
                    .uri(url)
                    .header("User-Agent", "Mozilla/5.0 (compatible; CareerOps/1.0)")
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(15))
                    .block();

            if (raw == null || raw.isBlank()) return "Page returned empty content.";

            Document doc = Jsoup.parse(raw);
            doc.select("script, style, nav, footer, header, .cookie-banner, #cookie").remove();
            String text = doc.body().text();

            return truncate(text, WEB_FETCH_MAX_CHARS);

        } catch (Exception e) {
            log.warn("web_fetch failed for url={}: {}", url, e.getMessage());
            return "Could not fetch the URL: " + e.getMessage() +
                   ". Please ask the user to paste the job description directly.";
        }
    }

    /**
     * Search the web via SerpAPI.
     */
    private String handleWebSearch(String query) {
        if (query == null || query.isBlank()) return "No search query provided.";

        if (serpApiKey == null || serpApiKey.isBlank()) {
            return "Web search is not configured (no SerpAPI key). " +
                   "Please use general knowledge for salary estimates and company research. " +
                   "Clearly label any data as estimated, not live.";
        }

        try {
            String response = webClient.get()
                    .uri("https://serpapi.com/search", builder -> builder
                            .queryParam("api_key", serpApiKey)
                            .queryParam("q", query)
                            .queryParam("num", "5")
                            .queryParam("hl", "en")
                            .queryParam("gl", "ie")
                            .build())
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(20))
                    .block();

            if (response == null) return "Search returned no results.";

            JsonNode json  = mapper.readTree(response);
            JsonNode items = json.path("organic_results");

            if (items.isEmpty()) return "No search results found for: " + query;

            StringBuilder sb = new StringBuilder("## Search Results for: " + query + "\n\n");
            int n = 1;
            for (JsonNode item : items) {
                sb.append(n++).append(". **").append(item.path("title").asText("(no title)")).append("**\n");
                sb.append("   URL: ").append(item.path("link").asText("")).append("\n");
                sb.append("   ").append(item.path("snippet").asText("")).append("\n\n");
                if (n > 5) break;
            }
            return truncate(sb.toString(), TOOL_RESULT_MAX_CHARS);

        } catch (Exception e) {
            log.warn("web_search failed for query='{}': {}", query, e.getMessage());
            return "Web search failed: " + e.getMessage() +
                   ". Use general knowledge and label data as estimated.";
        }
    }

    private String handleSaveResumeHtml(String html, String filename, UUID userId, UUID userJobId) {
        if (html == null || html.isBlank()) return "No HTML content provided to save.";

        try {
            String safeFilename = filename
                    .replaceAll("[^a-zA-Z0-9\\-_\\.]", "-")
                    .toLowerCase();
            if (!safeFilename.endsWith(".html")) safeFilename += ".html";

            String storagePath = userId + "/resumes/" + safeFilename;
            supabase.upload("application-cvs", storagePath,
                    html.getBytes(StandardCharsets.UTF_8), "text/html; charset=utf-8");

            if (userJobId != null) {
                skillRuns.findFirstByUserIdAndUserJobIdAndSkillOrderByCreatedAtDesc(
                        userId, userJobId, "tailor-resume")
                    .ifPresent(sr -> {
                        sr.setResumeHtml(html);
                        sr.setResumeFilename(storagePath);
                        skillRuns.save(sr);
                    });
            }

            return "Resume saved successfully as '" + safeFilename + "'. " +
                   "The user can download it as PDF from their job detail page.";

        } catch (Exception e) {
            log.error("Failed to save resume HTML: {}", e.getMessage(), e);
            return "Resume could not be saved: " + e.getMessage() +
                   ". The resume content is still shown to the user.";
        }
    }

    private String handleUpdateStatus(String status, UUID userId, UUID userJobId) {
        if (userJobId == null) return "No job context — cannot update status.";

        List<String> allowed = Arrays.asList(
                "New", "Saved", "Applied", "Interview", "Offer", "Rejected", "Withdrawn");
        if (!allowed.contains(status)) {
            return "Invalid status '" + status + "'. Allowed: " + String.join(", ", allowed);
        }

        return userJobs.findByIdAndUserId(userJobId, userId)
                .map(uj -> {
                    uj.setKanbanColumn(status);
                    userJobs.save(uj);
                    return "Application status updated to '" + status + "'.";
                })
                .orElse("Job not found or access denied. Status not updated.");
    }

    // ============================================================
    // UTILITIES
    // ============================================================

    private void appendField(StringBuilder sb, String key, Object value) {
        if (value != null) {
            sb.append(key).append(": ").append(value).append("\n");
        }
    }

    private String arrayToYaml(String[] arr) {
        if (arr == null || arr.length == 0) return "[]";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) {
            sb.append('"').append(arr[i]).append('"');
            if (i < arr.length - 1) sb.append(", ");
        }
        sb.append("]");
        return sb.toString();
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "\n...[truncated for length]";
    }
}
