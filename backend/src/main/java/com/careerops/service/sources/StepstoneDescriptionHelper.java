package com.careerops.service.sources;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jsoup.Jsoup;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extracts job posting text from StepStone-family detail pages (IrishJobs.ie, Jobs.ie, etc.)
 * via embedded {@code window.__PRELOADED_STATE__} payloads and common HTML blocks.
 */
public final class StepstoneDescriptionHelper {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Pattern PRELOADED_MARKER =
            Pattern.compile("window\\.__PRELOADED_STATE__\\[\"([^\"]+)\"\\]\\s*=\\s*");
    private static final int MIN_USEFUL_LENGTH = 80;

    private StepstoneDescriptionHelper() {}

    public static boolean isStepstoneJobUrl(String url) {
        if (url == null || url.isBlank()) return false;
        String u = url.toLowerCase(Locale.ROOT);
        return u.contains("irishjobs.")
                || u.contains("jobs.ie")
                || u.contains("stepstone.")
                || u.contains("totaljobs.");
    }

    /**
     * @param html full HTML of a job detail page
     */
    public static String extractFromHtml(String html) {
        if (html == null || html.isBlank()) return null;
        String best = null;
        Matcher m = PRELOADED_MARKER.matcher(html);
        while (m.find()) {
            String json = StepstonePreloadedParser.extractJsonObjectAfter(html, m.end());
            if (json == null || json.isBlank()) continue;
            try {
                JsonNode root = MAPPER.readTree(json);
                String candidate = longestDescriptionInTree(root);
                if (candidate != null && (best == null || candidate.length() > best.length())) {
                    best = candidate;
                }
            } catch (Exception ignored) {
                // try next preloaded chunk
            }
        }
        return best;
    }

    static String longestDescriptionInTree(JsonNode node) {
        if (node == null || node.isNull()) return null;
        String best = null;
        if (node.isObject()) {
            var fields = node.fields();
            while (fields.hasNext()) {
                var entry = fields.next();
                String key = entry.getKey();
                JsonNode value = entry.getValue();
                if (isDescriptionFieldName(key) && value != null) {
                    String normalized = normalizeDescriptionValue(value);
                    if (normalized != null && (best == null || normalized.length() > best.length())) {
                        best = normalized;
                    }
                }
                String nested = longestDescriptionInTree(value);
                if (nested != null && (best == null || nested.length() > best.length())) {
                    best = nested;
                }
            }
        } else if (node.isArray()) {
            for (JsonNode child : node) {
                String nested = longestDescriptionInTree(child);
                if (nested != null && (best == null || nested.length() > best.length())) {
                    best = nested;
                }
            }
        }
        return best;
    }

    private static boolean isDescriptionFieldName(String key) {
        if (key == null) return false;
        String k = key.toLowerCase(Locale.ROOT);
        return k.equals("description")
                || k.equals("jobdescription")
                || k.equals("intro")
                || k.equals("fulldescription")
                || k.equals("advertdescription")
                || k.equals("advertisementtext")
                || k.equals("jobadvertisement");
    }

    private static String normalizeDescriptionValue(JsonNode value) {
        if (value == null || value.isNull()) return null;
        String raw;
        if (value.isTextual()) {
            raw = value.asText("").trim();
        } else if (value.isObject() && value.has("text")) {
            raw = value.get("text").asText("").trim();
        } else {
            return null;
        }
        return toPlainText(raw);
    }

    public static String toPlainText(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String text;
        if (raw.contains("<")) {
            var doc = Jsoup.parse(raw);
            doc.select("br").prepend("\n");
            doc.select("p, li, h1, h2, h3, h4").prepend("\n");
            text = doc.text();
        } else {
            text = raw;
        }
        text = text.replace('\u00a0', ' ')
                .replaceAll("(?i)\\bshow\\s+more\\b", "")
                .replaceAll("(?i)\\bshow\\s+less\\b", "")
                .replaceAll("[ \\t]+", " ")
                .replaceAll("\\n{3,}", "\n\n")
                .trim();
        return text.length() >= MIN_USEFUL_LENGTH ? text : null;
    }
}
