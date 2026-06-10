package com.careerops.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extracts and ranks a primary project URL from CV project text (repo preferred over live demo).
 */
public final class ProjectLinkExtractor {

    private static final Pattern LABELED_URL = Pattern.compile(
        "(?i)(?:github|gitlab|bitbucket|demo|live|url|link|repo|repository)\\s*[:\\-–]\\s*"
            + "((?:https?://\\S+)|(?:www\\.\\S+)|(?:github\\.com/\\S+)|(?:gitlab\\.com/\\S+)|(?:bitbucket\\.org/\\S+))"
    );

    private static final Pattern BARE_OR_HTTP_URL = Pattern.compile(
        "(?i)(https?://[^\\s<>\"']+|(?:www\\.)?github\\.com/[\\w.\\-/%]+|"
            + "(?:www\\.)?gitlab\\.com/[\\w.\\-/%]+|(?:www\\.)?bitbucket\\.org/[\\w.\\-/%]+|"
            + "(?:[\\w-]+\\.)?(?:vercel\\.app|netlify\\.app|github\\.io)/[\\w.\\-/%]*)"
    );

    private ProjectLinkExtractor() {}

    /** Best single URL from free text, or empty string. */
    public static String extractPrimary(String text) {
        List<String> candidates = findAll(text);
        if (candidates.isEmpty()) {
            return "";
        }
        return candidates.stream()
            .max(Comparator.comparingInt(ProjectLinkExtractor::repoScore))
            .orElse(candidates.get(0));
    }

    /** All unique normalized URLs in document order. */
    public static List<String> findAll(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }
        Set<String> seen = new LinkedHashSet<>();
        List<String> out = new ArrayList<>();

        Matcher labeled = LABELED_URL.matcher(text);
        while (labeled.find()) {
            addCandidate(out, seen, labeled.group(1));
        }

        Matcher bare = BARE_OR_HTTP_URL.matcher(text);
        while (bare.find()) {
            addCandidate(out, seen, bare.group(1));
        }

        return List.copyOf(out);
    }

    public static String normalizeUrl(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        String t = raw.strip();
        while (t.endsWith(".,;)]}") || t.endsWith(".")) {
            t = t.substring(0, t.length() - 1).strip();
        }
        if (t.isBlank() || isPlaceholder(t)) {
            return "";
        }
        String lower = t.toLowerCase(Locale.ROOT);
        if (lower.startsWith("mailto:") || lower.contains("linkedin.com/in/")) {
            return "";
        }
        if (t.startsWith("http://") || t.startsWith("https://")) {
            return t;
        }
        if (t.startsWith("www.")) {
            return "https://" + t;
        }
        if (looksLikeBareHost(t)) {
            return "https://" + t;
        }
        return "";
    }

    /** Remove all detected URL forms from text (for description cleanup). */
    public static String stripUrls(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        String cleaned = LABELED_URL.matcher(text).replaceAll("");
        cleaned = BARE_OR_HTTP_URL.matcher(cleaned).replaceAll("");
        return cleaned
            .replaceAll("(?m)^\\s*[•\\-*▪►#]+\\s*$", "")
            .replaceAll("\\n{3,}", "\n\n")
            .trim();
    }

    public static record ResolvedLink(String url, String cleanedText) {}

    /** Extract primary URL and return text with URL fragments removed. */
    public static ResolvedLink extractAndStrip(String text) {
        String url = extractPrimary(text);
        if (url.isBlank()) {
            return new ResolvedLink("", text != null ? text.trim() : "");
        }
        return new ResolvedLink(url, stripUrls(text));
    }

    private static void addCandidate(List<String> out, Set<String> seen, String raw) {
        String normalized = normalizeUrl(raw);
        if (normalized.isBlank()) {
            return;
        }
        String key = normalized.toLowerCase(Locale.ROOT);
        if (seen.add(key)) {
            out.add(normalized);
        }
    }

    private static boolean isPlaceholder(String value) {
        String lower = value.toLowerCase(Locale.ROOT);
        return lower.equals("link") || lower.equals("demo") || lower.equals("url") || lower.equals("live");
    }

    private static boolean looksLikeBareHost(String t) {
        return t.contains("github.com/")
            || t.contains("gitlab.com/")
            || t.contains("bitbucket.org/")
            || t.contains("vercel.app/")
            || t.contains("netlify.app/")
            || t.contains("github.io/");
    }

    private static int repoScore(String url) {
        String lower = url.toLowerCase(Locale.ROOT);
        if (lower.contains("github.com/") || lower.contains("gitlab.com/") || lower.contains("bitbucket.org/")) {
            return 100;
        }
        if (lower.contains("github.io/")) {
            return 80;
        }
        if (lower.contains("vercel.app/") || lower.contains("netlify.app/")) {
            return 60;
        }
        return 40;
    }
}
