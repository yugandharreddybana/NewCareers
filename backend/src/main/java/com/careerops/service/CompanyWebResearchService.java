package com.careerops.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * Fetches public web snippets about a company for the research skill (SerpAPI Google search).
 */
@Service
public class CompanyWebResearchService {

    private static final Logger log = LoggerFactory.getLogger(CompanyWebResearchService.class);

    @Value("${serpapi.api.key:}")
    private String serpApiKey;

    private final WebClient webClient;
    private final ObjectMapper mapper;

    public CompanyWebResearchService(ObjectMapper mapper) {
        this.mapper = mapper;
        HttpClient httpClient = HttpClient.create()
                .followRedirect(false)
                .responseTimeout(Duration.ofSeconds(12));
        this.webClient = WebClient.builder()
            .clientConnector(new ReactorClientHttpConnector(httpClient))
            .baseUrl("https://serpapi.com/search.json")
            .build();
    }

    public boolean isAvailable() {
        return serpApiKey != null && !serpApiKey.isBlank();
    }

    /**
     * @return markdown-ish research notes for AI context, or empty if unavailable
     */
    public String fetchCompanyIntel(String company, String roleTitle, String location) {
        if (!isAvailable() || company == null || company.isBlank()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        appendSearchResults(sb, company + " company culture employee reviews", "Culture & reviews");
        appendSearchResults(sb, company + " latest news 2025 2026", "Recent news");
        appendSearchResults(sb, company + " " + safe(roleTitle) + " salary Ireland", "Compensation signals");
        appendSearchResults(sb, company + " layoffs hiring freeze controversy", "Risk flags");
        return sb.toString().trim();
    }

    private void appendSearchResults(StringBuilder sb, String query, String heading) {
        List<String> snippets = searchSnippets(query);
        if (snippets.isEmpty()) return;
        sb.append("\n### ").append(heading).append("\n");
        for (String snippet : snippets) {
            sb.append("- ").append(snippet).append("\n");
        }
    }

    private List<String> searchSnippets(String query) {
        List<String> out = new ArrayList<>();
        try {
            String raw = webClient.get()
                .uri(uri -> uri
                    .queryParam("engine", "google")
                    .queryParam("q", query)
                    .queryParam("hl", "en")
                    .queryParam("gl", "ie")
                    .queryParam("num", 5)
                    .build())
                .header("X-SerpAPI-Key", serpApiKey)
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofSeconds(12))
                .block();
            if (raw == null || raw.isBlank()) return out;
            JsonNode root = mapper.readTree(raw);
            for (JsonNode item : root.path("organic_results")) {
                String title = item.path("title").asText("");
                String snippet = item.path("snippet").asText("");
                if (!snippet.isBlank()) {
                    out.add((title.isBlank() ? "" : title + ": ") + snippet);
                }
                if (out.size() >= 4) break;
            }
        } catch (Exception e) {
            log.debug("Company web research failed for '{}': {}", query, e.getMessage());
        }
        return out;
    }

    private static String safe(String s) {
        return s == null || s.isBlank() ? "" : s;
    }
}
