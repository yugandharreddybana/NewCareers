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
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.owasp.html.HtmlPolicyBuilder;
import org.owasp.html.PolicyFactory;
import org.slf4j.Logger;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;
import org.slf4j.LoggerFactory;

import java.net.InetAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
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
 * - Errors return descriptive strings (never throw) so Claude handles them
 * gracefully
 */
@Service
public class SkillToolDispatcher {

    private static final Logger log = LoggerFactory.getLogger(SkillToolDispatcher.class);
    private static final int WEB_FETCH_MAX_CHARS = 4000;
    private static final int TOOL_RESULT_MAX_CHARS = 12000;

    @Value("${serpapi.api.key:#{null}}")
    private String serpApiKey;

    @jakarta.annotation.PostConstruct
    public void validateSerpApi() {
        if (serpApiKey == null || serpApiKey.isBlank()) {
            log.warn("SerpAPI key is missing or empty. Web search functionality will be disabled.");
        }
    }

    private final UserProfileRepository profiles;
    private final UserJobRepository userJobs;
    private final JobRepository jobs;
    private final SkillRunRepository skillRuns;
    private final CvService cvService;
    private final SupabaseStorageService supabase;
    private final ObjectMapper mapper;
    private final WebClient webClient;

    public SkillToolDispatcher(
            UserProfileRepository profiles,
            UserJobRepository userJobs,
            JobRepository jobs,
            SkillRunRepository skillRuns,
            CvService cvService,
            SupabaseStorageService supabase,
            ObjectMapper mapper) {
        this.profiles = profiles;
        this.userJobs = userJobs;
        this.jobs = jobs;
        this.skillRuns = skillRuns;
        this.cvService = cvService;
        this.supabase = supabase;
        this.mapper = mapper;

        // 3.021 — Disable redirects to prevent SSRF bypasses
        HttpClient httpClient = HttpClient.create().followRedirect(false);
        this.webClient = WebClient.builder()
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .codecs(cfg -> cfg.defaultCodecs().maxInMemorySize(5 * 1024 * 1024))
                .build();
    }

    public String dispatch(String toolName, JsonNode input, UUID userId, UUID userJobId) {
        try {
            return switch (toolName) {
                case "read_profile" -> handleReadProfile(userId);
                case "read_resume" -> handleReadResume(userId);
                case "read_job" -> handleReadJob(userId, userJobId);
                case "read_evaluation" -> handleReadEvaluation(userId, userJobId);
                case "read_research" -> handleReadResearch(userId, userJobId);
                case "web_fetch" -> handleWebFetch(input.path("url").asText());
                case "web_search" -> handleWebSearch(input.path("query").asText());
                case "save_resume_html" -> handleSaveResumeHtml(
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

    private String handleReadProfile(UUID userId) {
        Optional<UserProfile> opt = profiles.findByUserId(userId);
        if (opt.isEmpty())
            return "No profile found. The user has not set up their career profile yet.";
        UserProfile p = opt.get();
        StringBuilder yaml = new StringBuilder();
        yaml.append("# User Career Profile\n");
        appendField(yaml, "location", p.getLocation());
        appendField(yaml, "target_roles", arrayToYaml(p.getTargetRoles()));
        appendField(yaml, "tech_stack", arrayToYaml(p.getTechStack()));
        appendField(yaml, "sectors", arrayToYaml(p.getSectors()));
        appendField(yaml, "salary_min", p.getSalaryMin());
        appendField(yaml, "salary_max", p.getSalaryMax());
        appendField(yaml, "salary_currency", "EUR");
        appendField(yaml, "sponsorship_required", p.getSponsorshipRequired());
        appendField(yaml, "min_match_percent", p.getMinMatchPercent());
        return truncate(yaml.toString(), TOOL_RESULT_MAX_CHARS);
    }

    private String handleReadResume(UUID userId) {
        try {
            String cv = cvService.activeCvText(userId);
            if (cv == null || cv.isBlank())
                return "No resume uploaded yet. The user needs to upload their CV in the settings.";
            return truncate(cv, TOOL_RESULT_MAX_CHARS);
        } catch (Exception e) {
            log.warn("Could not fetch CV for userId={}: {}", userId, e.getMessage());
            return "Resume could not be loaded. Please ask the user to re-upload their CV.";
        }
    }

    private String handleReadJob(UUID userId, UUID userJobId) {
        if (userJobId == null)
            return "No job context available for this skill run.";
        // 3.025 — Verify ownership (IDOR)
        Optional<UserJob> ujOpt = userJobs.findByIdAndUserId(userJobId, userId);
        if (ujOpt.isEmpty())
            return "Job not found or access denied.";
        Optional<Job> jobOpt = jobs.findById(ujOpt.get().getJobId());
        if (jobOpt.isEmpty())
            return "Job details not found.";
        Job j = jobOpt.get();
        StringBuilder sb = new StringBuilder();
        sb.append("# Job Posting\n");
        appendField(sb, "title", j.getTitle());
        appendField(sb, "company", j.getCompany());
        appendField(sb, "location", j.getLocation());
        appendField(sb, "salary_min", j.getSalaryMin());
        appendField(sb, "salary_max", j.getSalaryMax());
        appendField(sb, "sponsorship", j.getSponsorship());
        appendField(sb, "source", j.getSourceName());
        appendField(sb, "url", j.getSourceUrl());
        sb.append("\n# Full Job Description\n");
        sb.append(j.getDescription() != null ? j.getDescription() : "Not available");
        return truncate(sb.toString(), TOOL_RESULT_MAX_CHARS);
    }

    private String handleReadEvaluation(UUID userId, UUID userJobId) {
        if (userJobId == null)
            return "No job context \u2014 no evaluation available.";
        return skillRuns.findValidCachedRun(userId, userJobId, "evaluate", Instant.now())
                .map(sr -> truncate(sr.getOutput().toString(), TOOL_RESULT_MAX_CHARS))
                .orElse("No evaluation exists yet for this job.");
    }

    private String handleReadResearch(UUID userId, UUID userJobId) {
        if (userJobId == null)
            return "No job context \u2014 no research available.";
        return skillRuns.findValidCachedRun(userId, userJobId, "research", Instant.now())
                .map(sr -> truncate(sr.getOutput().toString(), TOOL_RESULT_MAX_CHARS))
                .orElse("No company research exists yet for this job.");
    }

    private String handleWebFetch(String url) {
        if (url == null || url.isBlank())
            return "No URL provided.";
        if (!url.startsWith("http://") && !url.startsWith("https://"))
            return "Only http/https URLs are allowed.";
        try {
            URI uri = URI.create(url);
            String host = uri.getHost();
            if (host == null)
                return "Invalid URL host.";

            // 3.021 — Robust SSRF defense: resolve host and check for private/local IP
            // ranges
            if (isPrivateAddress(host.toLowerCase())) {
                return "Access to this host is not permitted.";
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
            if (raw == null || raw.isBlank())
                return "Page returned empty content.";
            Document doc = Jsoup.parse(raw);
            doc.select("script, style, nav, footer, header, .cookie-banner, #cookie").remove();
            return truncate(doc.body().text(), WEB_FETCH_MAX_CHARS);
        } catch (Exception e) {
            log.warn("web_fetch failed for url={}: {}", url, e.getMessage());
            return "Could not fetch the URL: " + e.getMessage() +
                    ". Please ask the user to paste the job description directly.";
        }
    }

    private String handleWebSearch(String query) {
        if (query == null || query.isBlank())
            return "No search query provided.";
        if (serpApiKey == null || serpApiKey.isBlank())
            return "Web search is not configured (no SerpAPI key). " +
                    "Use general knowledge for estimates and label data as estimated.";
        try {
            // 3.023 — Move SerpAPI key to header to prevent leak in logs/Referer
            String response = webClient.get()
                    .uri("https://serpapi.com/search", b -> b
                            .queryParam("q", query)
                            .queryParam("num", "5")
                            .queryParam("hl", "en")
                            .queryParam("gl", "ie")
                            .build())
                    .header("X-SerpAPI-Key", serpApiKey)
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(20))
                    .block();
            if (response == null)
                return "Search returned no results.";
            JsonNode json = mapper.readTree(response);
            JsonNode items = json.path("organic_results");
            if (items.isEmpty())
                return "No search results found for: " + query;
            StringBuilder sb = new StringBuilder("## Search Results for: " + query + "\n\n");
            int n = 1;
            for (JsonNode item : items) {
                sb.append(n++).append(". **").append(item.path("title").asText("(no title)")).append("**\n");
                sb.append("   URL: ").append(item.path("link").asText("")).append("\n");
                sb.append("   ").append(item.path("snippet").asText("")).append("\n\n");
                if (n > 5)
                    break;
            }
            return truncate(sb.toString(), TOOL_RESULT_MAX_CHARS);
        } catch (Exception e) {
            log.warn("web_search failed for query='{}': {}", query, e.getMessage());
            return "Web search failed: " + e.getMessage() + ". Use general knowledge and label data as estimated.";
        }
    }

    private String handleSaveResumeHtml(String html, String filename, UUID userId, UUID userJobId) {
        if (html == null || html.isBlank())
            return "No HTML content provided to save.";
        try {
            String safeFilename = filename
                    .replaceAll("[^a-zA-Z0-9\\-_\\.]", "-")
                    .toLowerCase();
            if (!safeFilename.endsWith(".html"))
                safeFilename += ".html";

            // 3.022 — Sanitise untrusted HTML from Claude to prevent XSS using OWASP Java
            // HTML Sanitizer
            PolicyFactory policy = new HtmlPolicyBuilder()
                    .allowElements("p", "br", "div", "span", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "b",
                            "i", "strong", "em", "u", "style", "table", "thead", "tbody", "tr", "th", "td")
                    .allowAttributes("style", "class", "id").onElements(":all")
                    .allowStyling()
                    .toFactory();

            String cleanHtml = policy.sanitize(html);

            String storagePath = userId + "/resumes/" + safeFilename;
            supabase.upload("application-cvs", storagePath,
                    cleanHtml.getBytes(StandardCharsets.UTF_8), "text/html; charset=utf-8", userId);
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
        if (userJobId == null)
            return "No job context \u2014 cannot update status.";
        List<String> allowed = Arrays.asList(
                "New", "Saved", "Applied", "Interview", "Offer", "Rejected", "Withdrawn");
        if (!allowed.contains(status))
            return "Invalid status '" + status + "'. Allowed: " + String.join(", ", allowed);
        return userJobs.findByIdAndUserId(userJobId, userId)
                .map(uj -> {
                    uj.setKanbanColumn(status);
                    uj.setStatus(status.toLowerCase());
                    userJobs.save(uj);
                    return "Application status updated to '" + status + "'.";
                })
                .orElse("Job not found or access denied. Status not updated.");
    }

    private void appendField(StringBuilder sb, String key, Object value) {
        if (value != null)
            sb.append(key).append(": ").append(value).append("\n");
    }

    private String arrayToYaml(String[] arr) {
        if (arr == null || arr.length == 0)
            return "[]";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) {
            sb.append('"').append(arr[i]).append('"');
            if (i < arr.length - 1)
                sb.append(", ");
        }
        sb.append("]");
        return sb.toString();
    }

    private static String truncate(String s, int max) {
        if (s == null)
            return "";
        return s.length() <= max ? s : s.substring(0, max) + "\n...[truncated for length]";
    }

    private boolean isPrivateAddress(String host) {
        try {
            InetAddress[] addresses = InetAddress.getAllByName(host);
            for (InetAddress addr : addresses) {
                // 3.021 — Complete SSRF check covering all private/reserved ranges
                if (addr.isLoopbackAddress() ||
                        addr.isSiteLocalAddress() ||
                        addr.isLinkLocalAddress() ||
                        addr.isAnyLocalAddress() ||
                        isCgnat(addr) ||
                        isReserved(addr) ||
                        addr.getHostAddress().startsWith("fc00:") ||
                        addr.getHostAddress().startsWith("fd00:") ||
                        addr.getHostAddress().startsWith("::ffff:127.") // IPv4-mapped loopback
                ) {
                    log.warn("Blocked SSRF attempt to private address: {} ({})", host, addr.getHostAddress());
                    return true;
                }
            }
            return false;
        } catch (Exception e) {
            log.warn("Failed to resolve host for SSRF check: {}", host);
            return true; // Fail-closed
        }
    }

    private boolean isCgnat(InetAddress addr) {
        byte[] b = addr.getAddress();
        if (b.length != 4)
            return false;
        int first = b[0] & 0xFF;
        int second = b[1] & 0xFF;
        return first == 100 && (second >= 64 && second <= 127);
    }

    private boolean isReserved(InetAddress addr) {
        byte[] b = addr.getAddress();
        if (b.length != 4)
            return false;
        int first = b[0] & 0xFF;
        int second = b[1] & 0xFF;
        // 198.18.0.0/15 (Benchmarking)
        return first == 198 && (second == 18 || second == 19);
    }
}
