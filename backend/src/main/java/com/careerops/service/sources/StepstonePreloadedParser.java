package com.careerops.service.sources;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Parses job listings embedded in StepStone/IrishJobs/Jobs.ie result pages
 * ({@code window.__PRELOADED_STATE__["app-unifiedResultlist"]}).
 */
final class StepstonePreloadedParser {

    private static final Logger log = LoggerFactory.getLogger(StepstonePreloadedParser.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String MARKER = "window.__PRELOADED_STATE__[\"app-unifiedResultlist\"] = ";

    record Listing(String title, String company, String location, String relativeUrl) {}

    private StepstonePreloadedParser() {}

    static List<Listing> parse(String html, String baseUrl) {
        String json = extractPreloadedJson(html);
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            JsonNode root = MAPPER.readTree(json);
            List<Listing> found = new ArrayList<>();
            Set<String> seen = new HashSet<>();
            collectListings(root, found, seen);
            return found;
        } catch (Exception e) {
            log.debug("Stepstone PRELOADED_STATE JSON parse failed: {}", e.getMessage());
            return List.of();
        }
    }

    private static String extractPreloadedJson(String html) {
        int idx = html.indexOf(MARKER);
        if (idx < 0) {
            return null;
        }
        return extractJsonObjectAfter(html, idx + MARKER.length());
    }

    /** Extracts a balanced JSON object starting at the first {@code \{} after {@code fromIndex}. */
    static String extractJsonObjectAfter(String html, int fromIndex) {
        if (html == null || fromIndex < 0 || fromIndex >= html.length()) {
            return null;
        }
        String chunk = html.substring(fromIndex);
        int braceStart = chunk.indexOf('{');
        if (braceStart < 0) {
            return null;
        }
        int depth = 0;
        boolean inString = false;
        for (int i = braceStart; i < chunk.length(); i++) {
            char c = chunk.charAt(i);
            if (inString) {
                if (c == '\\' && i + 1 < chunk.length()) {
                    i++;
                    continue;
                }
                if (c == '"') {
                    inString = false;
                }
                continue;
            }
            if (c == '"') {
                inString = true;
            } else if (c == '{') {
                depth++;
            } else if (c == '}') {
                depth--;
                if (depth == 0) {
                    return chunk.substring(braceStart, i + 1);
                }
            }
        }
        return null;
    }

    private static void collectListings(JsonNode node, List<Listing> out, Set<String> seen) {
        if (node == null || node.isNull()) {
            return;
        }
        if (node.isObject()) {
            JsonNode urlNode = node.get("url");
            JsonNode titleNode = node.get("title");
            if (urlNode != null && urlNode.isTextual()
                && titleNode != null && titleNode.isTextual()) {
                String rel = urlNode.asText("");
                if (rel.startsWith("/job/")) {
                    String title = titleNode.asText("").trim();
                    if (!title.isBlank() && !isSkippedTitle(title)) {
                        String company = textOrEmpty(node.get("company"));
                        if (company.isBlank()) {
                            company = IrishJobsSource.extractCompanyFromUrl(rel);
                        }
                        String location = textOrEmpty(node.get("location"));
                        if (location.isBlank()) {
                            location = textOrEmpty(node.get("city"));
                        }
                        String key = rel + "|" + title;
                        if (seen.add(key)) {
                            out.add(new Listing(title, company, location, rel));
                        }
                    }
                }
            }
            node.fields().forEachRemaining(e -> collectListings(e.getValue(), out, seen));
        } else if (node.isArray()) {
            for (JsonNode child : node) {
                collectListings(child, out, seen);
            }
        }
    }

    private static boolean isSkippedTitle(String title) {
        return title.equalsIgnoreCase("Oh no, this job is no longer available.");
    }

    private static String textOrEmpty(JsonNode node) {
        return node != null && node.isTextual() ? node.asText("").trim() : "";
    }

    static String toAbsoluteUrl(String baseUrl, String relativeUrl) {
        if (relativeUrl == null || relativeUrl.isBlank()) {
            return baseUrl;
        }
        if (relativeUrl.startsWith("http")) {
            return relativeUrl;
        }
        if (relativeUrl.startsWith("/")) {
            return baseUrl + relativeUrl;
        }
        return baseUrl + "/" + relativeUrl;
    }
}
